const {MapCache} = require('./MapCache');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const app = express();
const PORT = process.env.PORT || 3000;
const proxied_host = 'https://http.cat';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Кэш сервер',
            version: '1.0.0',
            description: 'Кэш сервер для сайта https://http.cat',
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
 *         description: при любом значении этого параметра НЕ будет брать картинку из кэша, если она там есть
 *         in: query
 *         required: false
 *         allowEmptyValue: true  
 *     responses:
 *       200:
 *         description: Картинка кота, взятая с https://http.cat/
 *         content:
 *           image/jpg:
 *             schema:
 *       203:
 *         description: Картинка кота, взятая из кэша
 *         content:
 *           image/jpg:
 *             schema:
 *       404:
 *         description: Запрашиваемого кода состояния не существует
 *         content:
 *           application/txt:
 *             schema:             
 */
app.get('/:status_code', async (req, res) => {
    let status_code = req.params.status_code;
    let use_cache = !Object.hasOwn(req.query, 'dont_use_cache');
    // Проверяю, есть ли картинка в кэше
    if (use_cache && cache.has_key(status_code)) {
        // если есть, вовзращаю картинку из кэша
        res.type('image/jpg')
            .status(203)
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
        cache.update(status_code, buffer);
        // и возвращаю картинку с кодом 200
        res.type('image/jpg')
            .send(buffer);
    }
});

/**
 * @swagger
 *
 * /update_cache:
 *   patch:
 *     summary: Обновить все картинки из кэша
 *     tags:
 *       - Cache server
 *     responses:
 *       200:
 *         description: Кэш успешно обновлён
 */
app.patch('/update_cache', async (req, res) => {
    let status_codes = cache.get_keys();
    for (let status_code of status_codes) {
        let {response, buffer} = await fetch_data_and_transform_to_buffer(status_code);
        // Если неудачный запрос, то ничего не делаю
        if (!response.ok) {

        } else {
            cache.update(status_code, buffer);
        }
    }

    res.sendStatus(200);
});


/**
 * @swagger
 *
 * /clear_cache:
 *   patch:
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
 */
app.patch('/clear_cache', (req, res) => {
    let keys = cache.get_keys();
    cache.clear();

    // Отправляю json для отладки
    res.json({count: keys.length, keys});
});



app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});