// Reproductor del vídeo de una tarea/aviso: mp4 directo del servidor; si es un enlace de Drive, iframe.
export default function VideoTarea({ url }) {
  if (!url) return null
  const esMp4 = /\.mp4(\?|$)/i.test(url)
  return (
    <div className="aviso-video" onClick={e => e.stopPropagation()}>
      {esMp4
        ? <video src={url} controls playsInline preload="metadata" />
        : <iframe src={url} allow="autoplay" title="vídeo" />}
      <a className="link" href={esMp4 ? url : url.replace('/preview', '/view')} target="_blank" rel="noreferrer">abrir en grande ↗</a>
    </div>
  )
}
