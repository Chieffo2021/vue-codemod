import wrap from '../src/wrapAstTransformation'
import type { ASTTransformation } from '../src/wrapAstTransformation'

export const transformAST: ASTTransformation = ({ root, j }) => {
  //  find the import xxx from 'vuex/dist/logger'
  const importDeclarationCollection = root.find(j.ImportDeclaration, node => {
    return (
      node.specifiers.length === 1 &&
      node.specifiers[0].type === 'ImportDefaultSpecifier' &&
      node.source.value === 'vuex/dist/logger'
    )
  })
  if (!importDeclarationCollection.length) return

  const importName =
    importDeclarationCollection.get(0).node.specifiers[0].local.name
  if (importName !== 'createLogger') {
    //  rename function name
    root
      .find(j.CallExpression, node => {
        return node.callee.name === importName
      })
      .replaceWith(({ node }) => {
        // @ts-ignore
        return j.callExpression(j.identifier('createLogger'), node.arguments)
      })
  }

  //  remove import
  importDeclarationCollection.remove()

  //  add import
  const addImport = require('./add-import')
  addImport.transformAST(
    { root, j },
    {
      specifier: {
        type: 'named',
        imported: 'createLogger'
      },
      source: 'vuex'
    }
  )
}

export default wrap(transformAST)
export const parser = 'babylon'
