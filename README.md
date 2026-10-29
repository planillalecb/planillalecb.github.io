# Planilla · TMA LECB

Versión web de la [aplicación Android Planilla](https://github.com/jtoledo1974/Planilla), limitada al núcleo TMA y con una interfaz móvil sencilla.

## Uso

1. Elige **8 × 3** o **3 × 1** y pulsa tu número.
2. Elige los sectores TMA en orden. Cada sector elegido queda bloqueado para evitar repetirlo.
3. Consulta la planilla. Toca el horario para abrir el esquema original. **Cancelar** vuelve a la selección inicial.

La app calcula automáticamente el turno de mañana, tarde o mañana siguiente según la hora actual, igual que la aplicación Android. Un turno activo se recupera al volver a abrir la página y se elimina al terminar.

En **Preferencias** puedes configurar el preaviso de Ejecutivo y Ayudante, el sonido y la vibración. Se mantienen las reglas de avisos de la aplicación original, incluida la retirada de tarjeta tras un tramo de Ayudante. La pantalla de alarma se cierra automáticamente a los 20 segundos o con **Descartar alarma**.

**Límite del navegador:** las alarmas web pueden funcionar mientras la página está abierta, pero no tienen la misma garantía que el servicio y el despertador nativos de Android cuando está cerrada o el sistema suspende la web. GitHub Pages puede alojar la interfaz y los horarios, pero no un servicio de alarmas en segundo plano.

## Probar en local

Puedes abrir `index.html` directamente. Para probar también la instalación y el uso sin conexión, sirve la carpeta por HTTP:

```sh
python3 -m http.server 8000
```

Abre `http://localhost:8000`.

## GitHub Pages

Este proyecto está preparado para el repositorio `planillalecb/planillalecb.github.io`. Una vez publicado desde la rama `main`, la dirección será [https://planillalecb.github.io/](https://planillalecb.github.io/). En **Settings → Pages → Build and deployment** hay que seleccionar **GitHub Actions**. El flujo de `.github/workflows/pages.yml` publicará la web tras cada cambio en `main`.

Los horarios, sectores y esquemas gráficos proceden del repositorio original. Si no eres titular de esos contenidos, revisa sus derechos antes de publicar la copia.
