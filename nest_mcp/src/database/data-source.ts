import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Task } from '../modules/tasks/entities/task.entity';
import { Comment } from '../modules/comments/entities/comment.entity';

/**
 * TypeORM DataSource used by:
 *   - Migration CLI  (npm run migration:*)
 *   - AppModule      (TypeOrmModule.forRootAsync re-uses the same URL)
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, Task, Comment],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false, // always false — use migrations
  logging: process.env.NODE_ENV === 'development',
});
