# Публикация на GitHub Pages

## 1. Создать отдельный репозиторий

Например:

```text
dup-process-portal
```

## 2. Загрузить содержимое этой папки в корень репозитория

В корне должны лежать:

```text
index.html
assets/
processes/
.nojekyll
```

## 3. Добавить ваши материалы

До публикации лучше заменить демо BPMN и положить исходный HTML:

```text
processes/realization/diagram/realization.bpmn
processes/realization/guide/dup_game_1.html
processes/realization/document/regulation.pdf
```

## 4. Включить GitHub Pages

В GitHub:

```text
Repository
→ Settings
→ Pages
→ Build and deployment
→ Source: Deploy from a branch
→ Branch: main
→ Folder: / (root)
→ Save
```

Через некоторое время появится адрес примерно такого вида:

```text
https://USERNAME.github.io/dup-process-portal/
```

Все ссылки в проекте относительные, поэтому имя репозитория менять в коде не нужно.

## 5. Проверить три вкладки

- `Схема` — BPMN загружается, работают zoom/fullscreen;
- `Документ` — PDF показывается внутри страницы;
- `Моя роль` — оригинальный `dup_game_1.html` работает внутри iframe.

## Важно

Если материалы внутренние и не предназначены для публичного Интернета, не публикуйте их в публичном GitHub Pages без согласованного режима доступа.
