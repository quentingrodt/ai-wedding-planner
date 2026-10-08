import * as Sentry from "@sentry/nextjs";
import { sharedSentryOptions } from "@/lib/monitoring/sentry-options";

Sentry.init(sharedSentryOptions);
