import type { Register } from 'claude-code'

// Nivel de dificultad -> modelo (alias) y nombre para mostrar
const NIVELES: Record<string, { model: string; nombre: string }> = {
  simple: { model: 'haiku', nombre: 'Haiku (económico)' },
  media: { model: 'sonnet', nombre: 'Sonnet (intermedio)' },
  compleja: { model: 'opus', nombre: 'Opus (potente)' },
}

// Forzar a mano escribiendo #haiku, #sonnet u #opus en el mensaje
const FORZAR = /#(haiku|sonnet|opus)\b/i

const PREGUNTA =
  'Clasificá este pedido de un usuario a un asistente de IA según cuánto razonamiento necesita.\n' +
  'simple: saludo, charla, pregunta corta, dato puntual, confirmar algo, un paso sencillo.\n' +
  'media: tarea normal: buscar info, instalar algo siguiendo pasos, editar un archivo, resumir, usar la PC.\n' +
  'compleja: programar o crear algo nuevo grande, analizar código o seguridad, planificar, depurar errores difíciles.\n\n' +
  'Pedido:\n'

export const register: Register = on => {
  // modelo elegido para cada turno del chat principal
  const elegido = new Map<string, { model: string; nombre: string }>()

  on('turn.start', async ($, e, next) => {
    if (e.agentId || !e.text.trim()) return next(e)

    let nivel = NIVELES.media
    const forzado = e.text.match(FORZAR)
    if (forzado) {
      const m = forzado[1].toLowerCase()
      nivel = Object.values(NIVELES).find(n => n.model === m) ?? nivel
    } else {
      try {
        const label = await $.model.classify(PREGUNTA + e.text.slice(0, 4000), ['simple', 'media', 'compleja'], { model: 'haiku' })
        if (label && NIVELES[label]) nivel = NIVELES[label]
      } catch {
        // si falla la clasificación, queda el intermedio
      }
    }

    elegido.set(e.turnId, nivel)
    if (elegido.size > 50) elegido.delete(elegido.keys().next().value as string)
    $.ui.status(\`Portero: \${nivel.nombre}\`)
    $.ui.toast(\`Portero → \${nivel.nombre}\`)
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const nivel = e.agentId ? undefined : elegido.get(e.turnId)
    return yield* next(nivel ? { ...e, model: nivel.model } : e)
  })
}
