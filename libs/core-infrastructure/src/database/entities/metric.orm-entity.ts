import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('metrics')
export class MetricOrmEntity {
  @PrimaryGeneratedColumn('uuid')
    id!: string;

  @Column()
    metricType!: string;

  @Column('float')
    value!: number;

  @Column()
    period!: string;

  @Column({ nullable: true })
    unit!: string;

  @Column('jsonb', { nullable: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata!: Record<string, any>;

  @CreateDateColumn()
    createdAt!: Date;

  @UpdateDateColumn()
    updatedAt!: Date;
}
