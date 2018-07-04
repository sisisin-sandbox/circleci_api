const fs = require('fs');
const path = require('path');
const fetch = require('isomorphic-fetch');

const token = process.env.CIRCLE_TOKEN;
if (token == null) {
  throw Error('CIRCLE_TOKENいれて');
}

async function main() {
  const forceFetch = process.argv[2] === '-f';
  const recentBuilds = await fetchOrReadRecentBuilds(forceFetch);
  writeJson('recent_builds.json', recentBuilds);
  const maped = remap(recentBuilds);
  writeJson('queue_jobs.json', maped);
  writeCsv(maped);
}

async function fetchOrReadRecentBuilds(forceFetch) {
  if (forceFetch) {
    return fetchRecentBuilds();
  } else {
    try {
      return JSON.parse(fs.readFileSync('./dist/recent_builds.json').toString());
    } catch (e) {
      return fetchRecentBuilds();
    }
  }

  async function fetchRecentBuilds() {
    return (await Promise.all(
      [0].map(n => {
        const url = `https://circleci.com/api/v1.1/recent-builds?circle-token=${token}&limit=100&offset=${n}`;
        return fetch(url).then(res => res.json());
      }),
    )).reduce((prev, curr) => [...prev, ...curr], []);
  }
}

function remap(recentBuilds) {
  return recentBuilds.map(
    ({ parallel, branch, start_time, vcs_url, usage_queued_at, build_time_millis, build_num }) => {
      const repo = vcs_url.substr(28);
      const [sDate, sTime] = start_time === null ? [null, null] : processDate(start_time);
      const [qDate, qTime] = processDate(usage_queued_at);
      return {
        parallel,
        branch,
        start_date: sDate,
        start_time: sTime,
        repo,
        usage_queued_at_date: qDate,
        usage_queued_at_time: qTime,
        build_time_millis,
        build_num,
      };
    },
  );
}

function writeJson(name, records) {
  fs.writeFileSync(path.resolve('./dist/', name), JSON.stringify(records, null, '  '));
}

function writeCsv(records) {
  const header = [
    'build_num',
    'repo',
    'branch',
    'parallel',
    'usage_queued_at_date',
    'usage_queued_at_time',
    'start_date',
    'start_time',
    'build_time_millis',
  ].join(',');

  const body = records
    .map(
      ({
        parallel,
        branch,
        start_time,
        start_date,
        repo,
        usage_queued_at_date,
        usage_queued_at_time,
        build_time_millis,
        build_num,
      }) =>
        [
          build_num,
          repo,
          branch,
          parallel,
          usage_queued_at_date,
          usage_queued_at_time,
          start_date,
          start_time,
          build_time_millis,
        ].join(','),
    )
    .join('\n');
  fs.writeFileSync('./dist/queue_jobs.csv', header + '\n' + body);
}

function processDate(dateString) {
  const d = new Date(dateString);
  const date = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  const time = `${d
    .getHours()
    .toString()
    .padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
  return [date, time];
}

main().catch(e => console.error(e));
