import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('dynamic_metrics')
export class DynamicMetricOrmEntity {
  @PrimaryGeneratedColumn('uuid')
    id!: string;

  @Column({ unique: true })
    name!: string;

  @Column()
    type!: string;

  @Column()
    eventType!: string;

  @Column()
    period!: string;

  @Column()
    field!: string;

  @Column('jsonb', { nullable: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filters!: Record<string, any>;

  @CreateDateColumn()
    createdAt!: Date;

  @UpdateDateColumn()
    updatedAt!: Date;
}
