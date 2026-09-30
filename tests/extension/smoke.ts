import * as vscode from 'vscode';
import assert from 'node:assert/strict';
export async function run() {
  const extension = vscode.extensions.getExtension('mewra.mewra-blackbox');
  assert.ok(extension);
  const api = await extension.activate();
  assert.equal(api.apiVersion, 1);
  assert.equal(api.status().configured, false);
  const commands = await vscode.commands.getCommands(true);
  for (const command of [
    'approve',
    'run',
    'runAll',
    'results',
    'cancel',
    'secret',
    'install',
    'baseline',
    'proposals',
  ])
    assert.ok(commands.includes(`mewra-blackbox.${command}`));
  await vscode.commands.executeCommand('mewra-blackbox.results');
  await vscode.commands.executeCommand('mewra-blackbox.cancel');
  console.log(
    'Blackbox activated without PreFlight, registered all commands, and opened the result viewer.',
  );
}
