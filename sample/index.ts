import { parse, z } from '../lib';

const vars = {
    APP_PORT: '5000',
    REDIS_PORT: '1',
    ALLOW_SEND_MAIL: 'False',
    APP_VERSION_WINDOWS_LATEST: '1.0.0'
};

const env = parse(vars, {
    APP_PORT: z.number().min(1000).max(9999),
    REDIS: {
        PORT: z.number().default(6379),
        HOST: z.string().default('localhost')
    },
    ALLOW_SEND_MAIL: z.boolean().default(true),
    APP_VERSION: {
        WINDOWS: {
            LATEST: z.string().optional()
        }
    }
});

console.log(env.REDIS.PORT);
