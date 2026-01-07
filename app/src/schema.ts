import { defineTable, t, Engine, relations } from '@housekit/orm';

export const users = defineTable('users', {
  id: t.uuid('id')
    .autoGenerate({ version: 7 })
    .primaryKey(),
  email: t.string('email'),
  role: t.enum('role', ['admin', 'user']),
  password: t.string('password'),
  phone_number: t.string('phone_number'),
  ...t.timestamps(),
}, {
  engine: Engine.MergeTree(),
  orderBy: 'id',
});

export const events = defineTable('events', {
  id: t.uuid('id')
    .autoGenerate({ version: 7 })
    .primaryKey(),
  userId: t.uuid('user_id'),
  type: t.string('type'),
  createdAt: t.timestamp('created_at').default('now()'),
}, {
  engine: Engine.MergeTree(),
  orderBy: 'createdAt',
});

relations(users, ({ many }) => ({
  events: many(events, { fields: [users.id], references: [events.userId] })
}));

export type User = typeof users.$type;
export type NewUser = typeof users.$insert;
export type Event = typeof events.$type;
export type NewEvent = typeof events.$insert;
