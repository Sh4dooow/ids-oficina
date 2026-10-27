import { Bot } from 'grammy'
import OpenAI from 'openai'
import { db, decir } from './db.js'
import { jefeConversa } from './agentes.js'

// Bot de Telegram = puerta de entrada al Jefe. Texto o audio.
export function arrancarTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) { console.log('[telegram] sin token, bot desactivado'); return }
  const bot = new Bot(token)
  const soloYo = process.env.TELEGRAM_CHAT_ID

  bot.use(async (ctx, next) => {
    if (soloYo && String(ctx.chat?.id) !== String(soloYo)) return ctx.reply('Esta oficina es privada.')
    await next()
  })

  bot.command('start', ctx => ctx.reply('👔 Jefe de Iván Digital Studio. Mándame texto o un audio con lo que quieres que hagamos.'))

  bot.command('estado', async ctx => {
    const { data } = await db.from('tareas').select('titulo, estado, asignado_a').neq('estado', 'listo').order('creado_en')
    ctx.reply(data?.length ? data.map(t => `• ${t.titulo} — ${t.estado} (${t.asignado_a || '-'})`).join('\n') : 'Nada en curso.')
  })

  bot.on('message:text', async ctx => {
    await ctx.replyWithChatAction('typing')
    await decir('ivan', 'jefe', ctx.message.text, null, 'telegram')
    const r = await jefeConversa({ contenido: ctx.message.text, tipo: 'telegram' })
    ctx.reply(r || 'Hecho.')
  })

  bot.on(['message:voice', 'message:audio'], async ctx => {
    if (!process.env.OPENAI_API_KEY) return ctx.reply('Para audios necesito OPENAI_API_KEY en el .env (Whisper). Escríbemelo por texto mientras tanto.')
    await ctx.replyWithChatAction('typing')
    const file = await ctx.getFile()
    const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`
    const res = await fetch(url)
    const blob = await res.blob()
    const openai = new OpenAI()
    const tr = await openai.audio.transcriptions.create({
      file: new File([blob], 'audio.ogg', { type: 'audio/ogg' }), model: 'whisper-1', language: 'es',
    })
    await decir('ivan', 'jefe', tr.text, null, 'audio')
    const r = await jefeConversa({ contenido: tr.text, tipo: 'audio' })
    ctx.reply(`🎙 "${tr.text}"\n\n${r || 'Hecho.'}`)
  })

  bot.start()
  console.log('[telegram] bot arrancado')
  return bot
}

// Avisos al móvil cuando algo pasa a LISTO
export async function avisar(bot, texto) {
  if (bot && process.env.TELEGRAM_CHAT_ID) await bot.api.sendMessage(process.env.TELEGRAM_CHAT_ID, texto)
}
