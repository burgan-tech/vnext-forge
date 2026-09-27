import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

interface ContributedCommand {
  command: string;
  title: string;
  category?: string;
  icon?: string;
}
interface MenuEntry {
  command: string;
  when?: string;
  group?: string;
}

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf8')) as {
  activationEvents: string[];
  contributes: {
    views: Record<string, { id: string; name: string; when?: string }[]>;
    commands: ContributedCommand[];
    menus: Record<string, MenuEntry[]>;
  };
};
const extensionSource = readFileSync(fileURLToPath(new URL('../../extension.ts', import.meta.url)), 'utf8');

const NEW_COMMANDS = [
  'vnextForge.tools.generateIndexSqlAll',
  'vnextForge.tools.generateIndexSqlForFlow',
  'vnextForge.tools.refreshWfCliStatus',
];

describe('Database view contributes', () => {
  it('declares the view in the Forge Tools container for vNext workspaces', () => {
    expect(pkg.contributes.views.vnextForgeTools).toContainEqual({
      id: 'vnextForge.tools.database',
      name: 'Database',
      when: 'vnextForge.isVnextWorkspace',
    });
    expect(pkg.activationEvents).toContain('onView:vnextForge.tools.database');
    expect(extensionSource).toContain("createTreeView('vnextForge.tools.database'");
  });

  it('contributes, exposes and registers every new command', () => {
    for (const id of NEW_COMMANDS) {
      const command = pkg.contributes.commands.find((c) => c.command === id);
      expect(command, id).toBeDefined();
      expect(command?.category).toBe('Forge');
      expect(command?.icon).toMatch(/^\$\([a-z-]+\)$/);
      expect(pkg.contributes.menus.commandPalette).toContainEqual({
        command: id,
        when: 'vnextForge.isVnextWorkspace',
      });
      expect(extensionSource).toContain(`registerCommand('${id}'`);
    }
  });

  it('puts the refresh button on the Database and Package Deploy views', () => {
    expect(pkg.contributes.menus['view/title']).toContainEqual({
      command: 'vnextForge.tools.refreshWfCliStatus',
      when: 'view == vnextForge.tools.database || view == vnextForge.tools.packageDeploy',
      group: 'navigation',
    });
  });
});
