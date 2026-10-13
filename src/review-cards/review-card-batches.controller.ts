import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { CreateReviewCardBatchDto } from './dto/create-review-card-batch.dto';
import { ReviewCardsService } from './review-cards.service';

@Controller('review-card-batches')
@UseGuards(PlatformAdminGuard)
export class ReviewCardBatchesController {
  constructor(private readonly reviewCards: ReviewCardsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateReviewCardBatchDto) {
    return this.reviewCards.createBatch(body.label, body.quantity);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    return this.reviewCards.listBatches(pageNum, limitNum);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  getOne(@Param('id') id: string) {
    return this.reviewCards.getBatchById(id);
  }

  @Get(':id/cards')
  @HttpCode(HttpStatus.OK)
  listCards(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
    return this.reviewCards.listCardsInBatch(id, pageNum, limitNum);
  }

  @Get(':id/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(@Param('id') id: string, @Res() res: Response) {
    const csv = await this.reviewCards.buildCsvExport(id);
    const batch = await this.reviewCards.getBatchById(id);
    const safeName = batch.label.replace(/[^a-zA-Z0-9._-]+/g, '_');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeName}.csv"`,
    );
    res.send(csv);
  }

  @Get(':id/export-qr.zip')
  async exportQrZip(@Param('id') id: string, @Res() res: Response) {
    const batch = await this.reviewCards.getBatchById(id);
    const safeName = batch.label.replace(/[^a-zA-Z0-9._-]+/g, '_');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeName}-qr.zip"`,
    );
    const stream = await this.reviewCards.buildQrZipStream(id);
    stream.pipe(res);
  }
}
