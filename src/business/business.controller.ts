import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { ListBusinessesQueryDto } from './dto/list-businesses-query.dto';
import {
  BusinessResponseDto,
  PublicBusinessResponseDto,
  PaginatedBusinessResponseDto,
} from './dto/business-response.dto';

@Controller('businesses')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PlatformAdminGuard)
  create(
    @Body() createBusinessDto: CreateBusinessDto,
  ): Promise<BusinessResponseDto> {
    return this.businessService.create(createBusinessDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformAdminGuard)
  findAll(
    @Query() query: ListBusinessesQueryDto,
  ): Promise<PaginatedBusinessResponseDto> {
    return this.businessService.findAll(query);
  }

  @Get('by-slug/:slug')
  @HttpCode(HttpStatus.OK)
  findPublicBySlug(
    @Param('slug') slug: string,
  ): Promise<PublicBusinessResponseDto> {
    return this.businessService.findPublicBySlug(slug);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformAdminGuard)
  findOne(@Param('id') id: string): Promise<BusinessResponseDto> {
    return this.businessService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformAdminGuard)
  update(
    @Param('id') id: string,
    @Body() updateBusinessDto: UpdateBusinessDto,
  ): Promise<BusinessResponseDto> {
    return this.businessService.update(id, updateBusinessDto);
  }
}
