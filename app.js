const {MapCache} = require('./MapCache');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const app = express();
const PORT = process.env.PORT || 3000;
const proxied_host = 'https://http.cat/';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Кэш сервер',
            version: '1.0.0',
            description: 'Кэш сервер для сайта https://http.cat/',
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
                description: `Локальный сервер, использующий порт ${PORT}`,
            },
        ],
    },
    apis: ['./app.js'],
};

const specs = swaggerJsdoc(options);

app.use(express.json());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs));

const cache = new MapCache();
/**
 * @swagger
 *
 * /:
 *   get:
 *     summary: Проверка работоспособности API
 *     tags:
 *       - Info
 *     responses:
 *       200:
 *         description: Возвращает сообщение о работоспособности API
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Добро пожаловать в наше REST API!"
 */
app.get('/', (req, res) => {
    res.json({message: 'Добро пожаловать в наше REST API!'});
});


async function fetch_data_and_transform_to_buffer(status_code) {
    let response = await fetch(proxied_host + '/' + String(status_code));
    if (!response.ok) {
        return {response, buffer: null};
    }
    let blob = await response.blob();
    let arrayBuffer = await blob.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);
    return {response, buffer};
}

/**
 * @swagger
 * tags:
 *   name: Cache server
 *   description: Операции кэширующего сервера
 */


/**
 * @swagger
 *
 * /{status_code}:
 *   get:
 *     summary: Получить картинку кота по коду состояния ответа HTTP
 *     tags:
 *       - Cache server
 *     parameters:
 *       - name: status_code
 *         description: код состояния ответа HTTP
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *       - name: dont_use_cache
 *         description: при использовании этого параметра, при любом его значении НЕ будет брать картинку из кэша, если она там есть
 *         in: query
 *         required: false
 *         allowEmptyValue: true
 *     responses:
 *       200:
 *         description: Картинка кота, соответствующая коду состояния ответа HTTP
 *         content:
 *           image/jpg:
 *             schema:
 *       404:
 *         description: Запрашиваемого кода состояния не существует
 *         content:
 *           text/plain:
 *             schema:
 */
app.get('/:status_code', async (req, res) => {
    let status_code = req.params.status_code;
    let use_cache = !Object.hasOwn(req.query, 'dont_use_cache');
    // Проверяю, есть ли картинка в кэше
    if (use_cache && cache.has_key(status_code)) {
        // если есть, вовзращаю картинку из кэша
        res.type('image/jpg')
            .send(cache.get_value(status_code));
    } else {
        // иначе делаю запрос к API
        let {response, buffer} = await fetch_data_and_transform_to_buffer(status_code);
        // Если код состояния НЕ успешый, возвращаю этот код
        if (!response.ok) {
            res.sendStatus(response.status);
            return;
        }
        // иначе обновляю кэш
        cache.add_or_update(status_code, buffer);
        // и возвращаю картинку с кодом 200
        res.type('image/jpg')
            .send(buffer);
    }
});

/**
 * @swagger
 *
 * /cache/update:
 *   put:
 *     summary: Обновить все картинки из кэша
 *     tags:
 *       - Cache server
 *     responses:
 *       200:
 *         description: Кэш успешно обновлён
 */
app.put('/cache/update', async (req, res) => {
    let status_codes = cache.get_keys();
    for (let status_code of status_codes) {
        let {response, buffer} = await fetch_data_and_transform_to_buffer(status_code);
        // Если неудачный запрос, то ничего не делаю
        if (!response.ok) {

        } else {
            cache.add_or_update(status_code, buffer);
        }
    }

    res.sendStatus(200);
});


/**
 * @swagger
 *
 * /cache/clear:
 *   put:
 *     summary: Очистить кэш
 *     tags:
 *       - Cache server
 *     responses:
 *       200:
 *         description: Кэш успешно очищен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Количество элементов в кэше до очистки
 *                   example: 3
 *                 keys:
 *                   type: array
 *                   description: Коды состояние, хранящиеся в кэше до очистки
 *                   example: [200, 301, 404]
 *                 capacity:
 *                   type: integer
 *                   description: Максимальный размер кэша
 *                   example: 5   
 */
app.put('/cache/clear', (req, res) => {
    let json = cache.serialize();
    cache.clear();

    // Отправляю json для отладки
    res.json(json);
});

/**
 * @swagger
 *
 * /cache/change_capacity:
 *   put:
 *     summary: Поменять размер кэша
 *     tags:
 *       - Cache server
 *     parameters:
 *       - name: capacity
 *         description: новый размер кэша
 *         in: query
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Размер кэша изменён
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Количество элементов в кэше после изменения размера
 *                   example: 3
 *                 keys:
 *                   type: array
 *                   description: Коды состояние, хранящиеся в кэше после изменения размера
 *                   example: [200, 301, 404]   
 *                 capacity:
 *                   type: integer
 *                   description: Максимальный размер кэша
 *                   example: 5
 *       400:
 *         description: Неверно указан новый размер кэша
 *         content:
 *           text/plain:
 *             schema:
 */
app.put('/cache/change_capacity', (req, res) => {
    let new_capacity = Number(req.query.capacity);
    if (Number.isNaN(new_capacity) || !Number.isFinite(new_capacity)) {
        res.status(400).send(`Capacity should be integer, got ${new_capacity}`);
        return;
    }

    if (new_capacity < -1) {
        res.status(400).send(`Capacity should be greater than or equal -1, got ${new_capacity}`);
        return;
    }

    cache.change_cache_capacity(new_capacity);
    res.json(cache.serialize());
});

/**
 * @swagger
 *
 * /cache/get:
 *   get:
 *     summary: Получить коды состояния, хранящиеся в кэше
 *     tags:
 *       - Cache server
 *     responses:
 *       200:
 *         description: Ок
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Количество элементов в кэше
 *                   example: 3
 *                 keys:
 *                   type: array
 *                   description: Коды состояние, хранящиеся в кэше
 *                   example: [200, 301, 404]
 *                 capacity:
 *                   type: integer
 *                   description: Максимальный размер кэша
 *                   example: 5
 */
app.get('/cache/get', (req, res) =>
{
    res.json(cache.serialize());
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});