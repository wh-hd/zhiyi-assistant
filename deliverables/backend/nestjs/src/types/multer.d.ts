// multer 在运行时由 @nestjs/platform-express 间接安装 (multer@2.2.0)，
// 但项目未安装 @types/multer。此处仅做模块声明，使 TS 编译通过。
// 上传逻辑使用内存存储 (默认)，文件内容通过 file.buffer 访问。
declare module 'multer';
