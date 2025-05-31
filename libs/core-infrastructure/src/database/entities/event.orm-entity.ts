import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('events')
export class EventOrmEntity {
  @PrimaryGeneratedColumn('uuid')
    id!: string;

  @Column()
    eventType!: string;

  @Column({ nullable: true })
    userId!: string;

  @Column({ nullable: true })
    sessionId!: string;
  
  @Column({ nullable: true })
    deviceId!: string;  

  @Column('timestamptz')
    timestamp!: Date;

  @Column('jsonb')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties!: Record<string, any>;

  @Column('jsonb', { nullable: true })
    context!: {
      userAgent?: string;
      ip?: string;
      country?: string;
      source?: string;
      referer?: string;
    };

  @CreateDateColumn()
    createdAt!: Date;
}
