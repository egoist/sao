const path = require('path')
const majo = require('majo')
const matcher = require('micromatch')
const { glob, fs } = require('majo')
const isBinaryPath = require('is-binary-path')
const logger = require('./logger')
const getGlobPatterns = require('./utils/getGlobPatterns')
const evaluate = require('./utils/evaluate')

module.exports = async (config, context) => {
  const actions =
    typeof config.actions === 'function'
      ? await config.actions.call(context, context)
      : config.actions

  for (const action of actions) {
    logger.debug('Running action:', action)
    if (action.type === 'add' && action.files) {
      const stream = majo()
      stream.source(['!**/node_modules/**'].concat(action.files), {
        baseDir: path.resolve(
          context.generator.path,
          action.templateDir || config.templateDir || 'template'
        )
      })

      if (action.filters) {
        const excludedPatterns = getGlobPatterns(
          action.filters,
          context.answers,
          true
        )

        if (excludedPatterns.length > 0) {
          stream.use(() => {
            const excludedFiles = matcher(stream.fileList, excludedPatterns)
            for (const file of excludedFiles) {
              stream.deleteFile(file)
            }
          })
        }
      }

      const shouldTransform =
        typeof action.transform === 'boolean'
          ? action.transform
          : config.transform !== false
      if (shouldTransform) {
        stream.use(({ files }) => {
          let fileList = Object.keys(stream.files)

          // Exclude binary path
          fileList = fileList.filter(fp => !isBinaryPath(fp))

          if (action.transformInclude) {
            fileList = matcher(fileList, action.transformInclude)
          }
          if (action.transformExclude) {
            fileList = matcher.not(fileList, action.transformExclude)
          }

          fileList.forEach(relativePath => {
            const contents = files[relativePath].contents.toString()
            const transformer = require('jstransformer')(
              require(`jstransformer-${config.transformer || 'ejs'}`)
            )
            const templateData = action.templateData || config.templateData
            stream.writeContents(
              relativePath,
              transformer.render(
                contents,
                config.transformerOptions,
                Object.assign(
                  {},
                  context.answers,
                  typeof templateData === 'function'
                    ? templateData.call(context, context)
                    : templateData,
                  {
                    context
                  }
                )
              ).body
            )
          })
        })
      }
      stream.on('write', (_, targetPath) => {
        logger.fileAction('magenta', 'Created', targetPath)
      })
      await stream.dest(context.outDir)
    } else if (action.type === 'modify' && action.handler) {
      const stream = majo()
      stream.source(action.files, { baseDir: context.outDir })
      stream.use(async ({ files }) => {
        await Promise.all(
          // eslint-disable-next-line array-callback-return
          Object.keys(files).map(async relativePath => {
            const isJson = relativePath.endsWith('.json')
            let contents = stream.fileContents(relativePath)
            if (isJson) {
              contents = JSON.parse(contents)
            }
            let result = await action.handler(contents, relativePath)
            if (isJson) {
              result = JSON.stringify(result, null, 2)
            }
            stream.writeContents(relativePath, result)
            logger.fileAction(
              'yellow',
              'Modified',
              path.join(context.outDir, relativePath)
            )
          })
        )
      })
      await stream.dest(context.outDir)
    } else if (action.type === 'move' && action.patterns) {
      await Promise.all(
        Object.keys(action.patterns).map(async pattern => {
          const files = await glob(pattern, {
            cwd: context.outDir,
            absolute: true,
            onlyFiles: false
          })
          if (files.length > 1) {
            throw new Error('"move" pattern can only match one file!')
          } else if (files.length === 1) {
            const from = files[0]
            const to = path.join(context.outDir, action.patterns[pattern])
            await fs.move(from, to, {
              overwrite: true
            })
            logger.fileMoveAction(from, to)
          }
        })
      )
    } else if (action.type === 'remove' && action.files) {
      let patterns
      if (typeof action.files === 'function') {
        action.files = action.files(context.answers)
      }
      if (typeof action.files === 'string' || Array.isArray(action.files)) {
        patterns = [].concat(action.files)
        if (action.when && !evaluate(action.when, context.answers)) {
          patterns = []
        }
      } else if (typeof action.files === 'object') {
        patterns = getGlobPatterns(action.files, context.answers)
      }
      const files = await glob(patterns, {
        cwd: context.outDir,
        absolute: true,
        onlyFiles: false
      })
      await Promise.all(
        files.map(file => {
          logger.fileAction('red', 'Removed', file)
          return fs.remove(file)
        })
      )
    }
  }
}
