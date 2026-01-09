/**
 * Hello World plugin — minimal starter template
 */

export function activate(context) {
  context.registerCommand({
    name: 'hello',
    description: 'Say hello from the plugin system',
    execute(args) {
      const name = args.trim() || 'World'
      return `Hello, ${name}! This message comes from the hello-world plugin.`
    },
  })
}

export function deactivate() {
  // Cleanup if needed
}
