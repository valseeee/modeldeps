#!/usr/bin/env node
import { readFileSync, appendFileSync } from 'node:fs';

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error('Package version is not a valid release artifact name');
}
const tag = `v${version}`;
if (process.env.GITHUB_EVENT_NAME === 'push') {
  if (process.env.GITHUB_REF_TYPE !== 'tag' || process.env.GITHUB_REF_NAME !== tag) {
    throw new Error(`Tag ${process.env.GITHUB_REF_NAME} does not match package version ${tag}`);
  }
} else if (process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch') {
  throw new Error('Release preparation requires a version tag or manual dispatch');
}
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\n`);
console.log(`${tag}: ${process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' ? 'manual preparation only; publication job is disabled' : 'tag matches package version'}`);
