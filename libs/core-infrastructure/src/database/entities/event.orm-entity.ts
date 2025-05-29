import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('events')
export class EventOrmEntity {
  @PrimaryGeneratedColumn('uuid')
    id!: string;

  @Column()
    eventType!: string;

  @Column({ nullable: true })
    userId!: string;

  @Column('timestamptz')
    timestamp!: Date;

  @Column('jsonb')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties!: Record<string, any>;

  @CreateDateColumn()
    createdAt!: Date;
}
