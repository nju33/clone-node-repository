#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const url = require('url');
const Git = require('nodegit');
const hasYarn = require('has-yarn');
const Listr = require('listr');
const execa = require('execa');
const chalk = require('chalk');
const meow = require('meow');

const cli = meow(`
Usage
  $ cnr <repository>

Options
  -h --help Shoe help
     --ssh-host

Examples
  $ cnr nju33/clone-node-repogitory

`, {
  alias: {
    h: 'help'
  }
})

if (typeof cli.input[0] === 'undefined') {
  console.log(chalk.red('Error: Repository not specified'));
  process.exit(1);
}

if (cli.flags.h) {
  console.log(cli.help);
  process.exit(0);
}

const [repository] = cli.input;

const tasks = new Listr([
  {
    title: `Cloning ${repository}`,
    task: cloneRepo(repository)
  },{
    title: 'Installing packages',
    task: installPackages()
  },{
    title: 'Post processing',
    task: postProcess()
  }
]);

tasks.run()
  .then(ctx => {
    console.log(`
  The environment is in place.
  Just move the directories with the following command

    cd ${ctx.repositoryName}
    `);
  })
  .catch(err => {
    console.log(chalk.red(err));
    process.exit(1);
  });

function cloneRepo(repository) {
  return ctx => {
    ctx.targetURL = createURL(repository);
    ctx.repositoryName = path.basename(repository);
    return Git.Clone(ctx.targetURL, `./${ctx.repositoryName}`);
  };
}

function installPackages() {
  return (ctx, task) => {
    process.chdir(ctx.repositoryName);
    return new Promise(resolve => {
      fs.access('./package.json', fs.constants.F_OK, err => {
        if (err !== null) {
          task.skip('Package.json is missing, skipping installation');
        }

        fs.access('./yarn.lock', fs.constants.F_OK, err => {
          if (err !== null) {
            task.title = 'Installing packages with npm'
            execa('npm', ['install']).then(({stdout}) => {
              resolve();
            });
          } else {
            task.title = 'Installing packages with yarn'
            execa('yarn').then(({stdout}) => {
              resole();
            })
          }
        });
      })
    })
  }
}

function postProcess() {
  return ctx => {
    if (cli.flags.sshHost) {
      const sshPath = `${cli.flags.sshHost}:${repository}.git`;
      return execa('git', ['remote', 'set-url', 'origin', sshPath]);
    }
    return Promise.resolve();
  };
}

function createURL(repository) {
  const urlObject = url.parse('https://github.com');
  urlObject.pathname = repository;
  return url.format(urlObject);
}
