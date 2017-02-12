'use strict'
const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const SAOError = require('./sao-error')

/**
 * Check if a string is repo name
 * @param {string} input - Input string
 * @return {boolean} true: repo false: npm
 */
exports.isRepo = function (input) {
  return input.indexOf('/') > -1
}

exports.getGlobalPackage = function (name) {
  return path.join(__dirname, '../../', name)
}

exports.isLocalPath = function (input) {
  return (input.charAt(0) === '.') || (input.charAt(0) === '/')
}

exports.checkIfPackageExists = function (packagePath, template, targetFolder) {
  return new Promise((resolve, reject) => {
    fs.access(packagePath, err => {
      const exists = !err
      if (!exists) {
        const message = `
${chalk.red(`You don’t seem to have a template with the name \`${template}\` installed.`)}

Run \`sao ${template}${targetFolder === './' ? '' : ` ${targetFolder}`} --install\` instead

Or install it with \`yarn global add template-${template}\` manually

${chalk.dim(`If you don't have Yarn, just run \`npm i -g template-${template}\` ;)`)}
`
        return reject(new SAOError(message))
      }
      resolve(exists)
    })
  })
}

exports.checkIfRepoExists = function (repoPath, template, targetFolder) {
  return new Promise((resolve, reject) => {
    fs.access(repoPath, err => {
      const exists = !err
      if (!exists) {
        const message = `
${chalk.red(`You don’t seem to have a repo with the name \`${template}\` downloaded.`)}

Run \`sao ${template}${targetFolder === './' ? '' : ` ${targetFolder}`} --install\` instead
`
        return reject(new SAOError(message))
      }
      resolve(exists)
    })
  })
}

exports.indent = function (str) {
  return str.replace(/^/gm, '  ')
}

exports.requireAt = function (location, name) {
  return require(path.join(location, 'node_modules', name))
}

exports.escapeDots = function (str) {
  return str.replace(/\./g, '\\.')
}

exports.getTemplates = function () {
  // only support templates installed by the same way with sao
  const templatesPath = path.join(__dirname, '..', '..')
  const templates = fs.readdirSync(templatesPath).filter(folder => /^template-/.test(folder))
  return templates
}

exports.logArray = function (arr) {
  arr.forEach(val => console.log(val))
}
