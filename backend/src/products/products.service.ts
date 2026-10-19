import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from './product.schema';
import { CreateProductDto } from './dto/create-product.dto';


 
function escapeRegExp(text : string){
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}



@Injectable()
export class ProductsService {
  constructor(@InjectModel(Product.name) private productModel: Model<Product>) {}

  async findAll(params: { page?: string; limit?: string; search?: string; category?: string, sortBy?: string }) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));

  const filter: any = {};
  if (params.search) {
    filter.name = new RegExp(escapeRegExp(params.search), 'i');
  }
  if (params.category) {
    filter.category = params.category;
  }

  const sortOptions: any = {
    name: { name: 1, _id: 1 },
    price: { price: 1, _id: 1 },
  };

  const sort = sortOptions[params.sortBy] || { createdAt: -1, _id: -1 };

  const [data, total] = await Promise.all([
    this.productModel
      .find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    this.productModel.countDocuments(filter),
  ]);

  return { data, total, page, limit };
}



async count() {
  const total = await this.productModel.countDocuments();
  return { total };
}
 async categories() {
  return this.productModel.distinct('category');
}
  async findOne(id: string) {
    return this.productModel.findById(id);
  }

  async create(dto: CreateProductDto) {
    return this.productModel.create(dto);
  }
}
