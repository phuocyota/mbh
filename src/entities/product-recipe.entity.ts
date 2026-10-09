import { Column, Entity, Index, ManyToOne, OneToMany, JoinColumn, Unique } from 'typeorm';
import { LedgerBaseEntity } from '../common/sql/ledger-base.entity';
import { Product } from './product.entity';

@Entity('product_recipes')
@Unique(['branchId', 'productId', 'version'])
@Index(['branchId', 'productId'])
@Index(['productId'])
export class ProductRecipe extends LedgerBaseEntity {
  @Column('uuid', { name: 'branch_id' }) branchId: string;

  /** The finished good that this recipe produces */
  @Column('uuid', { name: 'product_id' }) productId: string;

  /** Recipe version for tracking changes */
  @Column('int') version: number;

  /** Quantity of finished product this recipe produces */
  @Column('numeric', {
    name: 'yield_quantity',
    precision: 14,
    scale: 4,
  })
  yieldQuantity: number;

  @Column('uuid', { name: 'yield_unit_id' }) yieldUnitId: string;

  /** DRAFT, ACTIVE, ARCHIVED */
  @Column('varchar', { default: 'DRAFT' }) status: string;

  /** Optional effective date for version activation */
  @Column('timestamptz', { nullable: true, name: 'effective_from' })
  effectiveFrom: Date | null;

  @Column('text', { nullable: true }) description: string | null;

  @Column('numeric', {
    name: 'standard_cost',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  standardCost: number | null;

  // Relations
  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @OneToMany(() => ProductRecipeItem, (item) => item.recipe, {
    cascade: true,
  })
  items: ProductRecipeItem[];
}

@Entity('product_recipe_items')
@Unique(['recipeId', 'ingredientProductId'])
@Index(['ingredientProductId'])
export class ProductRecipeItem extends LedgerBaseEntity {
  @Column('uuid', { name: 'recipe_id' }) recipeId: string;

  @Column('uuid', { name: 'ingredient_product_id' })
  ingredientProductId: string;

  /** Quantity of ingredient needed per yieldQuantity of finished product */
  @Column('numeric', { precision: 14, scale: 4 }) quantity: number;

  @Column('uuid', { name: 'unit_id' }) unitId: string;

  /** Optional: specific lot requirement (e.g., must use lot from supplier X) */
  @Column('uuid', { name: 'required_lot_id', nullable: true })
  requiredLotId: string | null;

  /** Waste/scrap percentage for this ingredient */
  @Column('numeric', {
    name: 'waste_factor',
    precision: 5,
    scale: 2,
    default: 0,
  })
  wasteFactor: number;

  // Relations
  @ManyToOne(() => ProductRecipe, (recipe) => recipe.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'recipe_id' })
  recipe: ProductRecipe;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'ingredient_product_id' })
  ingredientProduct: Product;
}
