/*
 * Sauvegarde manuelle de Céleste (offre Supabase Free, sans sauvegarde
 * restaurable) : toutes les tables en JSON, les comptes, et les fichiers du
 * Storage, que même les sauvegardes Supabase payantes ne couvrent pas.
 *
 *   npm run backup
 *
 * Écrit dans backups/<date>/ (ignoré par git). Ces fichiers contiennent les
 * données personnelles des couples : à garder sur cette machine uniquement,
 * et à supprimer quand ils ne servent plus. Le schéma, lui, est dans
 * supabase/migrations.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être dans .env.local.");
  process.exit(1);
}

const PAGE = 1000;
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
// Heure locale : « 2026-10-09_10h32 ».
const stamp = new Date().toLocaleString("sv-SE").slice(0, 16).replace(" ", "_").replace(":", "h");
const root = path.join("backups", stamp);

async function writeJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2));
}

/** Tables exposées par l'API, avec leurs colonnes (pour trier la pagination). */
async function listTables() {
  const response = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: "application/openapi+json" },
  });
  if (!response.ok) throw new Error(`Liste des tables : HTTP ${response.status}`);
  const { definitions = {} } = await response.json();
  return Object.entries(definitions).map(([name, definition]) => ({
    name,
    columns: Object.keys(definition.properties ?? {}),
  }));
}

async function backupTable({ name, columns }) {
  // Un ordre stable évite de sauter ou doubler des lignes entre deux pages.
  const orderBy = columns.includes("id") ? ["id"] : columns.slice(0, 2);
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(name).select("*").range(from, from + PAGE - 1);
    for (const column of orderBy) query = query.order(column);
    const { data, error } = await query;
    if (error) throw new Error(`${name} : ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  await writeJson(path.join(root, "db", `${name}.json`), rows);
  return rows.length;
}

async function backupUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) throw new Error(`Comptes : ${error.message}`);
    users.push(...data.users);
    if (data.users.length < PAGE) break;
  }
  await writeJson(path.join(root, "auth-users.json"), users);
  return users.length;
}

/** Chemins de tous les fichiers d'un bucket, dossiers compris. */
async function listFiles(bucket, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`${bucket}/${prefix} : ${error.message}`);
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Les dossiers n'ont pas d'id.
      if (entry.id) files.push(full);
      else files.push(...(await listFiles(bucket, full)));
    }
    if (data.length < PAGE) break;
  }
  return files;
}

async function backupBucket(bucket) {
  const files = await listFiles(bucket);
  for (const file of files) {
    const { data, error } = await supabase.storage.from(bucket).download(file);
    if (error) throw new Error(`${bucket}/${file} : ${error.message}`);
    const target = path.join(root, "storage", bucket, ...file.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await data.arrayBuffer()));
  }
  return files.length;
}

const tables = await listTables();
const counts = {};
for (const table of tables) {
  counts[table.name] = await backupTable(table);
  console.log(`  ${table.name} : ${counts[table.name]} lignes`);
}
counts["auth.users"] = await backupUsers();
console.log(`  comptes : ${counts["auth.users"]}`);

const { data: buckets, error } = await supabase.storage.listBuckets();
if (error) throw new Error(`Buckets : ${error.message}`);
for (const { id } of buckets) {
  counts[`storage/${id}`] = await backupBucket(id);
  console.log(`  fichiers ${id} : ${counts[`storage/${id}`]}`);
}

await writeJson(path.join(root, "manifest.json"), { createdAt: new Date().toISOString(), url, counts });
console.log(`\nSauvegarde terminée : ${root}`);
