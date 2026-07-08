import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, of, tap } from 'rxjs';
import { CacheService } from './cache.service';

const MUTATION_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
/** TTL in seconds for cached GET responses */
const DEFAULT_TTL = 30;

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(private readonly cacheService: CacheService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user } = request as {
      method: string;
      url: string;
      user?: { workspaceId?: string };
    };

    const workspaceId: string | undefined = user?.workspaceId;
    if (!workspaceId) return next.handle();

    // Extract module name from URL: /api/v1/{module}/...
    const urlSegments = url.split('/').filter(Boolean); // ['api', 'v1', 'customers', ...]
    const moduleIndex = urlSegments.indexOf('v1');
    const moduleName =
      moduleIndex >= 0 ? urlSegments[moduleIndex + 1] : urlSegments[0];

    if (!moduleName) return next.handle();

    const prefix = CacheService.modulePrefix(workspaceId, moduleName);

    // Mutations: flush entire module cache, then proceed normally
    if (MUTATION_METHODS.has(method)) {
      await this.cacheService.flushPattern(prefix);
      return next.handle();
    }

    // GET: try to serve from cache
    const cacheKey = CacheService.buildKey(workspaceId, moduleName, url);
    const cached = await this.cacheService.get(cacheKey);
    if (cached !== null) {
      return of(cached);
    }

    // On response: store in cache
    return next.handle().pipe(
      tap(async (responseData) => {
        if (responseData !== undefined && responseData !== null) {
          await this.cacheService.set(cacheKey, responseData, DEFAULT_TTL);
        }
      }),
    );
  }
}
