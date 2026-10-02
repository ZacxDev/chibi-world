// drive-defold-mcp.mjs — end-to-end driver for the Defold MCP server.
// Reproduces the full loop a game-building agent would run:
//   tools/list -> init_project -> write script -> edit collection ->
//   build -> run headless -> Lua unit test -> verify.
//
// Lessons encoded (all discovered empirically 2026-10-01, bob 1.13.2):
//  - bob.jar 1.13.2 needs Java 25+ (class file v69). PATH in .mcp.json
//    puts ~/workspace/tools/jdk25/bin first.
//  - bob strips the trailing char of game.project resource refs, assuming
//    COMPILED paths ("/main/main.collectionc"). The MCP scaffold writes
//    source paths, so the driver rewrites game.project via fs (no MCP tool
//    covers game.project).
//  - Scaffold lacks input/game.input_binding (a bob root node) -> driver
//    creates a minimal one via fs.
//  - MCP's collection serializer drops the required `name:` field ->
//    driver prepends it if missing.
//  - bob 1.13.2 builds only the reachable closure ("Reduce Bob build
//    overhead"), so the Lua test runs by temporarily swapping
//    bootstrap.main_collection to the test collection.
//  - require() needs a `.lua` module file; MCP can only write `.script`,
//    so the test module is written via fs fallback.
//  - defold_run_headless spawns the engine in build/headless|build/debug;
//    bob actually emits build/default -> driver discovers the real dir and
//    falls back to a direct dmengine_headless run there.
//  - Engine prefixes prints with "DEBUG:SCRIPT: "; PASS: lines are matched
//    in the raw log, not via the MCP test parser.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname;
const LOGS = path.join(ROOT, 'logs');
const PROJECT = path.join(ROOT, 'tiny-game');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, '.mcp.json'), 'utf8')).mcpServers.defold;
const srv = { command: cfg.command, args: cfg.args, env: cfg.env };

const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);
const save = (name, obj) => fs.writeFileSync(path.join(LOGS, name),
  typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) + '\n');

let seq = 0, buf = '', pending = new Map();
const child = spawn(srv.command, srv.args, { stdio: ['pipe', 'pipe', 'inherit'], env: { ...process.env, ...srv.env } });
child.stdout.on('data', (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    const p = pending.get(msg.id);
    if (p) { pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result); }
  }
});
const rpc = (method, params) => new Promise((res, rej) => {
  const id = ++seq; pending.set(id, { resolve: res, reject: rej });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
});
const notify = (method, params) => {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
};
const callTool = async (name, args, timeoutMs = 200000) => {
  const r = await Promise.race([
    rpc('tools/call', { name, arguments: args }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('tool timeout ' + name)), timeoutMs)),
  ]);
  const c = r.content?.[0] ?? {};
  const text = c.type === 'text' ? c.text : JSON.stringify(c);
  let json = null; try { json = JSON.parse(text); } catch {}
  return { isError: !!r.isError, text, json };
};

const GAME_SCRIPT = `function init(self)
    print("TINY GAME RUNNING")
    self.frames = 0
end

function update(self, dt)
    self.frames = self.frames + 1
    if self.frames == 30 then
        print("TINY GAME: 30 frames done, quitting")
        msg.post("@system:", "exit", { code = 0 })
    end
end
`;

const INPUT_BINDING = `key_trigger {
  input: KEY_A
  action: "left"
}
key_trigger {
  input: KEY_D
  action: "right"
}
`;

const TEST_MODULE = `-- math_util: tiny pure-Lua module used to prove require() + assertions work
local M = {}

function M.add(a, b)
    return a + b
end

function M.mul(a, b)
    return a * b
end

function M.clamp(x, lo, hi)
    if x < lo then return lo end
    if x > hi then return hi end
    return x
end

return M
`;

const TEST_SCRIPT = `-- test_main: runs on bootstrap when the test collection is loaded.
local util = require("main.math_util")

local failures = 0

local function check(name, cond, reason)
    if cond then
        print("PASS: " .. name)
    else
        failures = failures + 1
        print("FAIL: " .. name .. ": " .. (reason or "assertion failed"))
    end
end

function init(self)
    check("add(2,3)==5", util.add(2, 3) == 5)
    check("add(-1,1)==0", util.add(-1, 1) == 0)
    check("mul(4,5)==20", util.mul(4, 5) == 20)
    check("mul(0,99)==0", util.mul(0, 99) == 0)
    check("clamp high", util.clamp(10, 0, 5) == 5)
    check("clamp low", util.clamp(-3, 0, 5) == 0)
    check("clamp mid", util.clamp(3, 0, 5) == 3)
    if failures == 0 then
        print("ALL TESTS PASSED")
    else
        print("TESTS FAILED: " .. failures)
    end
    msg.post("@system:", "exit", { code = failures })
end
`;

const TEST_COLLECTION = `name: "test"
scale_along_z: 0
embedded_instances {
  id: "test_runner"
  data: "components {\\n  id: \\"script\\"\\n  component: \\"/tests/test_main.script\\"\\n}\\n"
  position {
    x: 0
    y: 0
    z: 0
  }
}
`;

// ---- shell fallbacks for things the MCP server cannot do ----

// bob 1.13.2 strips the last char of game.project resource refs, assuming
// compiled paths ("/main/main.collectionc"). The MCP scaffold writes source
// paths, and omits input/game.input_binding (a bob root node).
function fixGameProject() {
  const gp = path.join(PROJECT, 'game.project');
  let t = fs.readFileSync(gp, 'utf8');
  t = t.replace('main_collection = /main/main.collection\n', 'main_collection = /main/main.collectionc\n');
  fs.writeFileSync(gp, t);
  fs.mkdirSync(path.join(PROJECT, 'input'), { recursive: true });
  fs.writeFileSync(path.join(PROJECT, 'input', 'game.input_binding'), INPUT_BINDING);
  log('game.project fixed (compiled bootstrap path) + input/game.input_binding created');
}

// MCP's collection serializer drops the required `name:` field.
function ensureCollectionName(collPath) {
  const p = path.join(PROJECT, collPath);
  let t = fs.readFileSync(p, 'utf8');
  if (!/^name:/m.test(t)) {
    fs.writeFileSync(p, 'name: "main"\nscale_along_z: 0\n' + t);
    log(collPath + ': prepended missing name field');
  }
}

function manualBob(args, timeoutMs, logName) {
  return new Promise((resolve) => {
    const p = spawn('java', ['-jar', srv.env.BOB, ...args],
      { cwd: PROJECT, env: { ...process.env, ...srv.env } });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    const t = setTimeout(() => { p.kill('SIGKILL'); out += '\n[TIMED OUT]\n'; }, timeoutMs);
    p.on('close', (code) => {
      clearTimeout(t);
      fs.writeFileSync(path.join(LOGS, logName), out);
      resolve({ code, out });
    });
  });
}

function findBuildDir() {
  const b = path.join(PROJECT, 'build');
  if (!fs.existsSync(b)) return null;
  for (const d of fs.readdirSync(b)) {
    if (fs.existsSync(path.join(b, d, 'game.projectc'))) return path.join(b, d);
  }
  return null;
}

function runEngineDirect(cwd, timeoutSec) {
  return new Promise((resolve) => {
    const p = spawn(srv.env.DMENGINE_HEADLESS, [], { cwd });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    const t = setTimeout(() => p.kill('SIGKILL'), timeoutSec * 1000);
    p.on('close', (code, sig) => { clearTimeout(t); resolve({ code, sig, out }); });
  });
}

async function buildViaMcp(label) {
  const build = await callTool('defold_build', { variant: 'headless', archive: true }, 200000);
  save(`build-${label}.json`, { isError: build.isError, text: build.text });
  const ok = build.json && build.json.success === true;
  log(`defold_build [${label}]: isError=${build.isError} success=${build.json?.success}`);
  return ok;
}

async function main() {
  fs.mkdirSync(LOGS, { recursive: true });
  log('spawning MCP server: ' + srv.command + ' ' + srv.args.join(' '));
  const init = await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'driver', version: '1.0' } });
  log('initialize ok: ' + JSON.stringify(init.serverInfo));
  await notify('notifications/initialized', {});
  const tools = await rpc('tools/list', {});
  const names = tools.tools.map((t) => t.name);
  save('tools.json', names);
  log('tools/list -> ' + names.join(', '));

  // 1. scaffold (tolerate existing from a previous run)
  const initRes = await callTool('defold_init_project', { name: 'tiny-game', targetPath: PROJECT });
  save('init-project.json', { isError: initRes.isError, text: initRes.text });
  if (initRes.isError && !/already exists/i.test(initRes.text)) throw new Error('init failed: ' + initRes.text);
  log('defold_init_project isError=' + initRes.isError + (initRes.isError ? ' (already scaffolded, continuing)' : ''));

  const info = await callTool('defold_project_info', {});
  log('defold_project_info: ' + info.text.slice(0, 160));

  // 2. write the game script through the MCP tool
  const w = await callTool('defold_write_script', { path: 'main/hello.script', content: GAME_SCRIPT });
  save('write-script.json', { isError: w.isError, text: w.text });
  log('defold_write_script main/hello.script isError=' + w.isError);
  if (w.isError) throw new Error('write failed');

  // 3. point the collection's game object at our script
  const r1 = await callTool('defold_edit_collection', { collectionPath: 'main/main.collection', operation: 'set_property', params: { gameObjectId: 'main', key: 'id', value: 'go' } });
  log('edit_collection rename main->go isError=' + r1.isError + ' (ok to fail on re-run: already renamed)');
  const r2 = await callTool('defold_edit_collection', { collectionPath: 'main/main.collection', operation: 'set_property', params: { gameObjectId: 'go', key: 'data', value: 'components {\n  id: "script"\n  component: "/main/hello.script"\n}\n' } });
  log('edit_collection repoint script->/main/hello.script isError=' + r2.isError);
  if (r2.isError) throw new Error('repoint failed: ' + r2.text);
  const mc = await callTool('defold_read_file', { path: 'main/main.collection' });
  save('main-collection-after-edits.txt', mc.text);
  const list = await callTool('defold_list_project', {});
  log('defold_list_project:\n' + list.text);

  // 4. shell fallbacks the MCP server cannot do (documented, not faked)
  fixGameProject();
  ensureCollectionName('main/main.collection');

  // 5. build via MCP (archive:true so the engine can load it); manual warm-up
  //    if the MCP tool's internal 120s cap trips on first engine download.
  let ok = await buildViaMcp('attempt-1');
  if (!ok) ok = await buildViaMcp('attempt-2');
  if (!ok) {
    log('MCP build unsuccessful; warming bob cache with a manual build (long timeout)…');
    const warm = await manualBob(['resolve', 'build', '--variant', 'headless', '--archive'], 900000, 'build-warmup-manual.log');
    log(`manual warm-up build: exit=${warm.code}`);
    ok = await buildViaMcp('after-warmup');
  }
  const buildDir = findBuildDir();
  log('build success=' + ok + '; build dir=' + buildDir);
  if (!ok || !buildDir) { child.kill(); save('RESULT.txt', 'BUILD FAILED'); process.exit(2); }

  // 6. run: MCP tool first, direct engine fallback (bob emits build/default,
  //    the tool looks in build/headless|build/debug)
  let runOut = '', runHow = '';
  const run = await callTool('defold_run_headless', { timeoutSec: 25 }, 120000);
  save('run-mcp.json', { isError: run.isError, text: run.text });
  if (!run.isError && /TINY GAME RUNNING/.test(run.text)) { runOut = run.text; runHow = 'defold_run_headless (MCP)'; }
  else {
    log('MCP run did not capture output; falling back to direct dmengine_headless in ' + buildDir);
    const d = await runEngineDirect(buildDir, 25);
    runOut = d.out; runHow = `direct dmengine_headless (exit=${d.code}, sig=${d.sig})`;
  }
  save('run.log', `via: ${runHow}\n` + runOut);
  const sawRunning = /TINY GAME RUNNING/.test(runOut);
  const sawDone = /TINY GAME: 30 frames done, quitting/.test(runOut);
  log(`run proof: TINY GAME RUNNING=${sawRunning}, 30-frames-done=${sawDone} (via ${runHow})`);

  // 7. Lua unit test. MCP cannot write .lua/.collection, so the module and
  //    test collection go via fs. bob 1.13.2 builds only the reachable
  //    closure, so bootstrap is temporarily swapped to the test collection.
  fs.writeFileSync(path.join(PROJECT, 'main', 'math_util.lua'), TEST_MODULE);
  fs.mkdirSync(path.join(PROJECT, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(PROJECT, 'tests', 'test_main.script'), TEST_SCRIPT);
  fs.writeFileSync(path.join(PROJECT, 'tests', 'test.collection'), TEST_COLLECTION);
  const gp = path.join(PROJECT, 'game.project');
  const gpOrig = fs.readFileSync(gp, 'utf8');
  fs.writeFileSync(gp, gpOrig.replace('main_collection = /main/main.collectionc', 'main_collection = /tests/test.collectionc'));
  log('test files written; bootstrap swapped to /tests/test.collectionc');
  const testBuildOk = await buildViaMcp('test');
  let testOut = '';
  if (testBuildOk) {
    const t = await runEngineDirect(findBuildDir(), 25);
    testOut = t.out;
  }
  save('test.log', testOut);
  const passes = (testOut.match(/^DEBUG:SCRIPT: PASS: .*/gm) || []).map((s) => s.replace('DEBUG:SCRIPT: ', ''));
  const allPassed = /ALL TESTS PASSED/.test(testOut);
  log(`test proof: ${passes.length} PASS lines, ALL TESTS PASSED=${allPassed}`);
  passes.forEach((p) => log('  ' + p));

  // 8. restore the game bootstrap and rebuild the final game state
  fs.writeFileSync(gp, gpOrig);
  await buildViaMcp('final-game');
  log('game bootstrap restored; final game build done');

  save('RESULT.txt',
    `run via: ${runHow}\nTINY GAME RUNNING: ${sawRunning}\n30 frames done: ${sawDone}\n` +
    `test PASS lines: ${passes.length}\nALL TESTS PASSED: ${allPassed}\n` +
    passes.join('\n') + '\n');
  child.kill();
  const failed = !sawRunning || !sawDone || !allPassed;
  log('driver done, ' + (failed ? 'FAILURES PRESENT' : 'ALL GREEN'));
  process.exit(failed ? 2 : 0);
}

main().catch((e) => { console.error('DRIVER FATAL:', e.message); try { child.kill(); } catch {} process.exit(1); });
