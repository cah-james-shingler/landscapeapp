const Promise = require('bluebird');
const traverse = require('traverse');
import fs from 'fs';
import path from 'path'
import _ from 'lodash';
import colors from 'colors';
import { settings, projectPath } from './settings';
import { addWarning } from './reporter';
import getRepositoryInfo from './getRepositoryInfo';
import makeReporter from './progressReporter';
const error = colors.red;
const fatal = (x) => colors.red(colors.inverse(x));
const cacheMiss = colors.green;
const debug = require('debug')('github');

import { getRepoStartDate } from './githubDates';

export async function extractSavedStartDateEntries() {
  const result = [];
  const traverse = require('traverse');
  let source = [];
  try {
    source =  require('js-yaml').safeLoad(fs.readFileSync(path.resolve(projectPath, 'processed_landscape.yml')));
  } catch(_ex) {
    console.info('Cannot extract github entries from the processed_landscape.yml');
  }
  const tree = traverse(source);
  tree.map(function(node) {
    if (!node) {
      return;
    }
    if (node.github_start_commit_data) {
      result.push({...node.github_start_commit_data, url: node.repo_url, branch: node.branch});
    }
  });
  return result;
}

async function getGithubRepos() {
  const source =  require('js-yaml').safeLoad(fs.readFileSync(path.resolve(projectPath, 'landscape.yml')));
  const tree = traverse(source);
  const repos = [];
  tree.map(function(node) {
    if (!node) {
      return;
    }
    if (node.item !== null) {
      return;
    }
    if (node.repo_url && node.repo_url.indexOf('https://github.com') === 0) {
      repos.push({
        url: node.repo_url,
        branch: node.branch
      });
    } /* else {
      if (!node.repo_url) {
        console.info(`item: ${node.name} has no repo url`)
      } else {
        console.info(`item: ${node.name} has a non github repo url`)
      }
    } */
  });
  return _.uniq(repos);
}

export async function fetchStartDateEntries({cache, preferCache}) {
  const repos = await getGithubRepos();
  const reporter = makeReporter();
  const result =  await Promise.map(repos, async function(repo) {
    const cachedEntry = _.find(cache, {url: repo.url, branch: repo.branch});
    if (cachedEntry && preferCache) {
      debug(`Cache found for ${repo.url}`);
      reporter.write('.');
      return cachedEntry;
    }
    debug(`Cache not found for ${repo.url}`);
    await Promise.delay(1 * 1000);
    const url = repo.url;
    const apiInfo  = await getRepositoryInfo(repo.url);
    const branch = repo.branch || apiInfo.default_branch;
    if (url.split('/').length !==  5 || !url.split('/')[4]) {
      console.info(url, ' does not look like a GitHub repo');
      return;
    }
    const repoName = url.split('/').slice(3,5).join('/');
    try {
      const { date, commitLink } = await getRepoStartDate({repo: repoName, branch});
      reporter.write(cacheMiss("*"));
      return ({url: repo.url, start_commit_link: commitLink, start_date: date});
    } catch (ex) {
      addWarning('githubStartDate');
      reporter.write(error('E'));
      debug(`Fetch failed for ${repo.url}, attempt to use a cached entry`);
      console.info(`Cannot fetch: ${repo.url} `, ex.message.substring(0, 200));
      return cachedEntry || null;
    }
  }, {concurrency: 20});
  reporter.summary();
  return result;
}
