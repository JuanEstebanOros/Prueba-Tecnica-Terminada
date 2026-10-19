import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from './order.schema';
import { Product } from '../products/product.schema';
import { Customer } from '../customers/customer.schema';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Customer.name) private customerModel: Model<Customer>,
  ) {}

async findAll(status?: string) {
  const filter: any = {};
  if (status) {
    filter.status = status;
  }

  const orders = await this.orderModel
    .find(filter)
    .sort({ createdAt: -1 })
    .lean();

  const customerIds = [...new Set(orders.map((o) => o.customerId.toString()))];
  const productIds = [
    ...new Set(orders.flatMap((o) => o.items.map((i) => i.productId.toString()))),
  ];

  const [customers, products] = await Promise.all([
    this.customerModel.find({ _id: { $in: customerIds } }).select('name').lean(),
    this.productModel.find({ _id: { $in: productIds } }).select('name').lean(),
  ]);

  const customerById = new Map(customers.map((c) => [c._id.toString(), c] as const));
  const productById = new Map(products.map((p) => [p._id.toString(), p] as const));

  return orders.map((order) => ({
    ...order,
    customer: customerById.get(order.customerId.toString()),
    items: order.items.map((item) => ({
      ...item,
      product: productById.get(item.productId.toString()),
    })),
  }));
}

  async findOne(id: string) {
    return this.orderModel.findById(id);
  }

  async create(dto: CreateOrderDto) {
    let total = 0;
   const productos = []


     for(const item of dto.items){
      const product = await this.productModel.findById(item.productId);

      if (!product) {
        throw new NotFoundException(`El producto ${item.productId} no existe`);
      }

      if (product.stock < item.quantity) {
        throw new BadRequestException(`No hay stock suficiente de ${product.name}`);
      }

      productos.push({ product, item })

    }

    for(const { product, item } of productos ){

      product.stock = product.stock - item.quantity;
      await product.save();

      // El precio sale de la BD, no del unitPrice que manda el cliente.
      total += product.price * item.quantity;
      }


    const order = await this.orderModel.create({
      customerId: dto.customerId,
      items: productos.map(({ product, item }) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.price,
      })),
      total: total,
      status: 'pending',
    });

    return order;
  }

  async updateStatus(id: string, status: string) {
    const order = await this.orderModel.findById(id);
    if (!order) {
      throw new NotFoundException(`La orden ${id} no existe`);
    }
    order.status = status;
    await order.save();
    return order;
  }

  async topProducts(limit: number) {
    const orders = await this.orderModel.find();

    const totals = {};
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.productId.toString();
        totals[key] = (totals[key] || 0) + item.quantity;
      }
    }

    const ranking = Object.keys(totals)
      .map((productId) => ({ productId, quantity: totals[productId] }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);

    const result = [];
    for (const r of ranking) {
      const product = await this.productModel.findById(r.productId);
      result.push({ name: product.name, quantity: r.quantity });
    }
    return result;
  }
}
