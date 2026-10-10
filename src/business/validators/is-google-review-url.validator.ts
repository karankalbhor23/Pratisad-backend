import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const GOOGLE_REVIEW_HOSTS = [
  'google.com',
  'www.google.com',
  'maps.google.com',
  'g.page',
  'goo.gl',
  'maps.app.goo.gl',
];

function isGoogleReviewHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return GOOGLE_REVIEW_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

@ValidatorConstraint({ name: 'isGoogleReviewUrl', async: false })
export class IsGoogleReviewUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value !== 'string') return false;
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) &&
        isGoogleReviewHost(url.hostname);
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'googleReviewUrl must be a Google Maps or Google review link';
  }
}

export function IsGoogleReviewUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsGoogleReviewUrlConstraint,
    });
  };
}

export function isGoogleReviewUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) &&
      isGoogleReviewHost(url.hostname);
  } catch {
    return false;
  }
}
