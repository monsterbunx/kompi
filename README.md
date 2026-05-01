# kompi

> Generador interactivo de `docker-compose.yml` — formulario web con preview en vivo.

```
   ╦╔═╔═╗╔╦╗╔═╗╦
   ╠╩╗║ ║║║║╠═╝║
   ╩ ╩╚═╝╩ ╩╩  ╩
```

Una app web sin frameworks que arma un `docker-compose.yml` desde un formulario y lo previsualiza al instante. Construida sobre la base de [vox](https://github.com/monsterbunx/vox): `debian:13` + `network_mode: host` + `python3 -m http.server`.

## Uso

### 1) Clona y levanta el contenedor

```sh
git clone git@github.com:monsterbunx/kompi.git ~/proyectos/kompi
cd ~/proyectos/kompi
docker compose up -d
```

> Si tu usuario no tiene el grupo `docker` cargado en la sesión actual, prefija con `sg docker -c "..."`.

### 2) Abre la app

```
http://localhost:8080
```

El puerto se publica directo en el host porque el contenedor usa `network_mode: host` — sin port mapping.

### 3) Usa el formulario

Cada cambio actualiza el YAML a la derecha en tiempo real (debounce de 30 ms).

- **service basics** — nombre del servicio, imagen, container_name, hostname, restart, working_dir, user
- **network** — `network_mode` y lista dinámica de `ports` (host:container)
- **volumes** — lista dinámica de mounts (`./host:/container[:ro]`)
- **environment** — variables `KEY=value`
- **capabilities** — checklist de capabilities comunes (NET_ADMIN, SYS_ADMIN, etc.) y flags `privileged`, `stdin_open`, `tty`
- **devices** — pasthrough de devices (`/dev/net/tun`, etc.)
- **process** — `entrypoint` y `command` (acepta tanto string `/bin/bash` como array JSON `["sh","-c","cmd"]`)

Defaults pre-cargados con la configuración de vox: `dev/dev/dev`, `network_mode: host`, `NET_ADMIN`, `/dev/net/tun`, `./scripts:/scripts`, command `["/bin/bash", "/scripts/main.sh"]`.

### 4) Candado de nombres 🔒

Junto a **service name** hay un candado SVG clickeable:

| Estado    | Color | Comportamiento                                                              |
|-----------|-------|-----------------------------------------------------------------------------|
| 🔒 cerrado | verde | `container_name` y `hostname` se sincronizan con `service name` (readonly)  |
| 🔓 abierto | rojo  | Los tres campos son independientes y editables                              |

Empieza cerrado. Click para alternar.

### 5) Acciones

- **copy** — copia el YAML al portapapeles (usa `navigator.clipboard` si el contexto es seguro, fallback a `document.execCommand` en HTTP)
- **download .yml** — descarga el archivo `docker-compose.yml`
- **reset** — vuelve a los defaults

## Estructura del proyecto

```
kompi/
├── docker-compose.yml    # contenedor 'web' debian:13, network host, monta scripts/ y www/
├── scripts/
│   └── main.sh           # apt update + python3 + http.server :8080
└── www/
    ├── index.html        # formulario + preview
    ├── style.css         # tema oscuro, CSS custom properties, grid 2-col
    └── app.js            # lectura del form, generación YAML, highlight, lock, copy/download
```

`./scripts` y `./www` se montan al contenedor por bind-mount: editas en el host y los cambios aparecen sin rebuild — solo recarga el navegador.

## Stack

- **Sin frameworks**: HTML/CSS/JS vanilla
- **Sin build step**: el archivo que escribes es el que sirve el contenedor
- **Sin backend**: la generación del YAML ocurre 100% en el navegador
- **Sin dependencias en el contenedor**: solo `python3` para el `http.server` estático

## YAML quoting

El generador detecta cuándo un valor necesita comillas para no romperse al parsear:

- Booleanos disfrazados (`yes`, `no`, `on`, `off`, `true`, `false`)
- Números (que YAML interpretaría como `int`/`float`)
- Caracteres reservados al inicio (`& * ! | > ? % @`)
- Valores que contienen `:` o `#`

Para `entrypoint` y `command`, si el valor empieza con `[` y termina con `]`, se emite como flow-array JSON sin tocar; si no, se trata como string (con quoting si hace falta).

## Detener el contenedor

```sh
docker compose down
```
