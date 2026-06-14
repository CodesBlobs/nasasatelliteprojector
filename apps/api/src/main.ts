import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
// Load workspace root .env. process.cwd() is apps/api/ in dev and dist/ context in prod.
loadEnv({ path: resolve(process.cwd(), '../../.env') })

import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import compression from 'compression'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  
  app.use(compression())

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  )

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })

  const config = new DocumentBuilder()
    .setTitle('Orbital API')
    .setDescription('Space Traffic Control Platform')
    .setVersion('0.1.0')
    .addTag('health')
    .addTag('satellites')
    .addTag('tle')
    .addTag('conjunctions')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, document)

  const port = process.env.API_PORT || 3001
  await app.listen(port)
  console.log(`API running on http://localhost:${port}`)
  console.log(`Swagger docs at http://localhost:${port}/api`)
}

bootstrap()

