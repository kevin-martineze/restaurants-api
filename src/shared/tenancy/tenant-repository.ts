import type { FilterQuery, Model, PipelineStage, UpdateQuery } from 'mongoose';

import { Types } from 'mongoose';

/** Todo documento de negocio pertenece a un tenant. */
export interface TenantOwned {
  tenantId: Types.ObjectId;
}

/** Un documento leído con `lean()`: objeto plano con su `_id`. */
export type Lean<T> = T & { _id: Types.ObjectId };

/**
 * Base de todo repositorio de datos de un restaurante.
 *
 * Mongo no tiene RLS: el aislamiento entre tenants lo garantiza esta clase.
 * Cada operación recibe el `tenantId` y lo agrega al filtro, a la creación o
 * al primer `$match` de una agregación. Los servicios no tocan el `Model`
 * directamente; si una consulta no cabe aquí, se agrega un método aquí.
 *
 * El `tenantId` sale de la sesión o del slug resuelto en el servidor, nunca
 * del cuerpo de una petición.
 */
export abstract class TenantRepository<T extends TenantOwned> {
  protected constructor(protected readonly model: Model<T>) {}

  protected scoped(tenantId: Types.ObjectId, filter: FilterQuery<T> = {}): FilterQuery<T> {
    return { ...filter, tenantId };
  }

  find(tenantId: Types.ObjectId, filter: FilterQuery<T> = {}): Promise<Lean<T>[]> {
    return this.model.find(this.scoped(tenantId, filter)).lean<Lean<T>[]>().exec();
  }

  findOne(tenantId: Types.ObjectId, filter: FilterQuery<T>): Promise<Lean<T> | null> {
    return this.model.findOne(this.scoped(tenantId, filter)).lean<Lean<T>>().exec();
  }

  /** Crea el documento dentro del tenant y devuelve su id. */
  async create(tenantId: Types.ObjectId, data: Omit<T, 'tenantId'>): Promise<Types.ObjectId> {
    // El id se genera aquí: con un `T` genérico, Mongoose no logra tipar el
    // `_id` del documento creado.
    const _id = new Types.ObjectId();

    await this.model.create({ ...data, tenantId, _id });

    return _id;
  }

  /** Cuántos documentos coincidieron (0 si no existe o es de otro tenant). */
  async updateOne(
    tenantId: Types.ObjectId,
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
  ): Promise<number> {
    const result = await this.model.updateOne(this.scoped(tenantId, filter), update).exec();

    return result.matchedCount;
  }

  async deleteMany(tenantId: Types.ObjectId, filter: FilterQuery<T> = {}): Promise<number> {
    const result = await this.model.deleteMany(this.scoped(tenantId, filter)).exec();

    return result.deletedCount;
  }

  aggregate<R>(tenantId: Types.ObjectId, pipeline: PipelineStage[]): Promise<R[]> {
    return this.model.aggregate<R>([{ $match: { tenantId } }, ...pipeline]).exec();
  }
}
