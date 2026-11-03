import { describe, expect, it } from 'vitest';

import { sandboxDiagnostics, validateCsxScript } from './CsxDiagnostics';

const members = (code: string) => sandboxDiagnostics(code).map((m) => [m.severity, m.message.split(':')[0]]);

describe('sandboxDiagnostics (runtime 0.0.102 banned APIs)', () => {
  it('accepts in-memory stream processing', () => {
    const code = [
      'var source = await GetFileAsync(context.Runtime.Domain, context.Instance.Flow, id, handle.file);',
      'using var input = source.OpenRead();',
      'var output = new MemoryStream();',
      'using var gz = new GZipStream(output, CompressionMode.Compress);',
      'var reader = new StreamReader(input);',
      'var obj = Activator.CreateInstance<MyType>();',
      'var stored = await PutFileAsync(d, f, i, "vnext-blob-s3", output, "a.pdf", "application/pdf");',
    ].join('\n');
    expect(sandboxDiagnostics(code)).toEqual([]);
  });

  it('flags file system, path constructors, Activator, Type.GetType and Environment', () => {
    expect(members('var bytes = File.ReadAllBytes("/etc/passwd");')).toEqual([['error', "banned member 'System.IO.File'"]]);
    expect(members('var w = new StreamWriter("out.txt");')).toEqual([['error', "banned member 'StreamWriter(string path)'"]]);
    expect(members('var o = Activator.CreateInstance(t);')).toEqual([['error', "banned member 'Activator.CreateInstance'"]]);
    expect(members('var t = Type.GetType("System.IO.File");')).toEqual([['error', "banned member 'Type.GetType'"]]);
    expect(members('Environment.Exit(1);')).toEqual([['error', "banned member 'Environment.Exit'"]]);
    expect(members('var m = typeof(X).GetMethod("Run");')).toEqual([['warning', "banned member 'Type.GetMethod'"]]);
  });

  it('ignores comments and look-alike identifiers', () => {
    expect(sandboxDiagnostics('// File.ReadAllBytes("x")')).toEqual([]);
    expect(sandboxDiagnostics('var f = ScriptFile.Empty; var p = data.Path;')).toEqual([]);
    expect(sandboxDiagnostics('/* File.ReadAllBytes("x");\n   Environment.Exit(1); */')).toEqual([]);
    expect(sandboxDiagnostics('var s = "File.Delete(x)"; var v = @"Path.Combine(""a"")";')).toEqual([]);
  });

  it('checks code after a // inside a string and fully qualified names', () => {
    expect(members('var u = "https://x"; File.Delete(u);')).toEqual([['error', "banned member 'System.IO.File'"]]);
    expect(members('var b = System.IO.File.ReadAllBytes(p);')).toEqual([['error', "banned member 'System.IO.File'"]]);
    expect(members('var c = System.IO.Path.Combine(a, b);')).toEqual([['error', "banned member 'System.IO.Path'"]]);
    expect(members('System.Environment.Exit(1);')).toEqual([['error', "banned member 'Environment.Exit'"]]);
  });

  it('feeds validateCsxScript for every template type', () => {
    expect(validateCsxScript('Environment.Exit(0);', 'mapping').some((m) => m.severity === 'error')).toBe(true);
  });
});
