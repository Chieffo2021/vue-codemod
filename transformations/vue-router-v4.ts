import wrap from '../src/wrapAstTransformation'
import type { ASTTransformation } from '../src/wrapAstTransformation'

import { transformAST as addImport } from './add-import'
import { transformAST as removeExtraneousImport } from './remove-extraneous-import'

import type { ObjectExpression } from 'jscodeshift'

// new Router() -> createRouter()
export const transformAST: ASTTransformation = context => {
  const { root, j } = context
  const routerImportDecls = root.find(j.ImportDeclaration, {
    source: {
      value: 'vue-router'
    }
  })

  const importedVueRouter = routerImportDecls.find(j.ImportDefaultSpecifier)
  if (importedVueRouter.length) {
    const localVueRouter = importedVueRouter.get(0).node.local.name

    const newVueRouter = root.find(j.NewExpression, {
      callee: {
        type: 'Identifier',
        name: localVueRouter
      }
    })

    let localCreateRouter = 'createRouter'
    // find whether createRouter has been used
    const createRouterIdentifiers = root.find(j.Identifier, {
      name: 'createRouter'
    })
    if (createRouterIdentifiers.length) {
      // rename createRouter to newCreateRouter
      localCreateRouter = 'newCreateRouter'
      addImport(context, {
        specifier: {
          type: 'named',
          imported: 'createRouter',
          local: localCreateRouter
        },
        source: 'vue-router'
      })
    } else {
      addImport(context, {
        specifier: { type: 'named', imported: 'createRouter' },
        source: 'vue-router'
      })
    }
    newVueRouter.replaceWith(({ node }) => {
      // mode: 'history' -> history: createWebHistory(), etc
      let historyMode = 'createWebHashHistory'
      let baseValue

      if (!j.ObjectExpression.check(node.arguments[0])) {
        throw new Error(
          'Currently, only object expressions passed to `new VueRouter` can be transformed.'
        )
      }

      const routerConfig: ObjectExpression = node.arguments[0]
      routerConfig.properties = routerConfig.properties.filter(p => {
        if (!j.ObjectProperty.check(p) && !j.Property.check(p)) {
          return true
        }

        if ((p.key as any).name === 'mode') {
          const mode = (p.value as any).value
          if (mode === 'hash') {
            historyMode = 'createWebHashHistory'
          } else if (mode === 'history') {
            historyMode = 'createWebHistory'
          } else if (mode === 'abstract') {
            historyMode = 'createMemoryHistory'
          } else {
            throw new Error(
              `mode must be one of 'hash', 'history', or 'abstract'`
            )
          }
          return false
        } else if ((p.key as any).name === 'base') {
          baseValue = p.value
          return false
        } else if ((p.key as any).name === 'fallback') {
          return false
        }

        return true
      })

      // add the default mode with a hash history
      addImport(context, {
        specifier: { type: 'named', imported: historyMode },
        source: 'vue-router'
      })
      node.arguments[0].properties = node.arguments[0].properties.filter(
        p => !!p
      )
      node.arguments[0].properties.unshift(
        j.objectProperty(
          j.identifier('history'),
          j.callExpression(
            j.identifier(historyMode),
            baseValue ? [baseValue] : []
          )
        )
      )

      return j.callExpression(j.identifier(localCreateRouter), node.arguments)
    })

    // VueRouter.START_LOCATION => import {START_LOCATION} from 'vue-router'
    const startLocationMember = root.find(j.MemberExpression, {
      object: {
        type: 'Identifier',
        name: localVueRouter
      },
      property: {
        type: 'Identifier',
        name: 'START_LOCATION'
      }
    })

    if (startLocationMember.length) {
      addImport(context, {
        specifier: { type: 'named', imported: 'START_LOCATION' },
        source: 'vue-router'
      })

      startLocationMember.replaceWith(({ node }) => {
        return node.property
      })
    }

    removeExtraneousImport(context, {
      localBinding: localVueRouter
    })
  }
}

export default wrap(transformAST)
export const parser = 'babylon'
