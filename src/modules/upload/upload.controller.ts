import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

const imageUploadInterceptor = FileInterceptor('file', {
  storage: diskStorage({
    destination: (req, _file, callback) => {
      if (!existsSync(UPLOAD_DIR)) {
        mkdirSync(UPLOAD_DIR, { recursive: true });
      }

      callback(null, UPLOAD_DIR);
    },
    filename: (_req, file, callback) => {
      const fileExt = extname(file.originalname || '').toLowerCase();
      const safeExt = fileExt || '.jpg';
      const filename = `image-${Date.now()}-${Math.round(
        Math.random() * 1e9,
      )}${safeExt}`;

      callback(null, filename);
    },
  }),
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype?.startsWith('image/')) {
      return callback(
        new BadRequestException('Only image files are allowed'),
        false,
      );
    }

    callback(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadController {
  @ApiOperation({ summary: 'Upload image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded' })
  @Post('images')
  @UseInterceptors(imageUploadInterceptor)
  async uploadImage(@UploadedFile() file: any, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const path = `/uploads/${file.filename}`;
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    return {
      filename: file.filename,
      path,
      imageUrl: `${baseUrl}${path}`,
    };
  }
}
