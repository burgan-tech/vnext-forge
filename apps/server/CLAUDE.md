# Server Instructions

## Logging

- Server tarafinda dogrudan `console.log`, `console.error`, `console.warn` veya diger `console.*` cagrilarini kullanma.
- Tum loglar merkezi logger uzerinden akmalidir: request icinde `c.get('logger')` veya `getRequestLogger(...)`, request disinda `baseLogger`.
- Controller seviyesinde loglar orchestration odakli ve kisa olmali; hata loglama merkezi olarak `error-handler` uzerinden devam etmelidir.
