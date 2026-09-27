import { WF_DOMAIN_FLAG_MIN_VERSION, WF_INDEXES_MIN_VERSION } from '@vnext-forge-studio/services-core';

/** A Workflow CLI capability that needs a minimum CLI version. */
export interface WfCliFeature {
  /** Completes "Workflow CLI <version> does not support …". */
  featureName: string;
  minVersion: string;
}

export const WF_CLI_FEATURES = {
  domainFlag: {
    featureName: 'the --domain option, so Forge is using the legacy "wf domain use <domain> && …" form',
    minVersion: WF_DOMAIN_FLAG_MIN_VERSION,
  },
  indexes: {
    featureName: 'index SQL generation (wf indexes generate)',
    minVersion: WF_INDEXES_MIN_VERSION,
  },
} as const satisfies Record<string, WfCliFeature>;

export function wfCliUpgradeMessage(version: string | undefined, feature: WfCliFeature): string {
  return (
    `Workflow CLI ${version ?? '(unknown version)'} does not support ${feature.featureName}. ` +
    `Update to ${feature.minVersion} or newer.`
  );
}
