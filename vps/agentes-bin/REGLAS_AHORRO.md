## HERRAMIENTAS DE UN SOLO PASO (obligatorio usarlas — cada llamada a herramienta cuesta dinero)
- `tarea entregar "texto ≤8 líneas con la ruta"` → entrega + pasa a revisión de Iván. ÚNICA forma de entregar.
- `tarea ok "qué vas a hacer" <créditos>` → pide el OK de gasto y PARAS. ÚNICA forma de pedir OK.
- `tarea pregunta "pregunta" "opción 1|opción 2"` → pregunta a Iván y PARAS.
- `tarea nota "texto"` → comentario suelto (casi nunca hace falta).
- `hf_esperar <job_id> <destino> ` → espera el job de Higgsfield y lo descarga en una sola llamada. Nunca hagas bucles de `higgsfield generate get`.
- PROHIBIDO llamar a la API de Paperclip con curl a mano, llamar a la skill `paperclip`, o actualizar la tarea en varios pasos: todo eso lo hacen `tarea` y `hf_esperar`.
- Toda salida de comando larga se recorta: `| tail -5`. No hagas `ls` de carpetas enteras, no imprimas JSON completos, no leas imágenes salvo que sea imprescindible para decidir.
- Un turno típico: (1) leer SOLO lo que falte, (2) un Bash agrupado que prepara y lanza, (3) `hf_esperar`, (4) `tarea entregar`. Cuatro llamadas. Más de seis es fallo.
