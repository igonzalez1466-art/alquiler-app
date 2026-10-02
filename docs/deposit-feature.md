# Fianza desactivada

`app/lib/features.ts` contiene `DEPOSITS_ENABLED = false`. Mientras siga así, los anuncios nuevos no aceptan fianza y todas las reservas nuevas guardan `depositCents = 0`. La pantalla de pago cobra solo el alquiler. El servidor rechaza el pago de solicitudes antiguas que todavía contienen una fianza; hay que crear una reserva nueva.

No se eliminan columnas, datos ni acciones de fianza. Una reserva que ya cobró fianza conserva su historial y su procedimiento de reclamación y devolución. La nueva liquidación sin fianza transfiere el alquiler al propietario después de confirmar la devolución y resolver las incidencias; utiliza la operación Stripe `rent` existente para impedir pagos duplicados. Si el intento no termina, el propietario ve una tarea y puede reintentarlo desde la reserva.

Antes de desplegar, revisar los PaymentIntents de reservas antiguas pendientes con fianza. Un cliente que ya tenga abierto un `client_secret` puede intentar pagar aunque el nuevo endpoint rechace la petición; esos intents deben cancelarse o tratarse como transacciones históricas si ya se cobraron. No borrar las reservas pagadas ni ejecutar una migración que ponga sus importes a cero.

Para recuperar la función, revisar primero la decisión legal y el texto del reglamento. Después cambiar `DEPOSITS_ENABLED` a `true` y verificar creación de anuncio, solicitud, aceptación, importe en Stripe, email de pago, reclamación, devolución y transferencia. La función no se activa por modificar una variable de entorno: requiere un nuevo despliegue.
