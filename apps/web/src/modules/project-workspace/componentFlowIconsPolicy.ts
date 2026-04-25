/**
 * Bileşen kökündeki `.json` dosyalarındaki `flow` alanına göre dosya ağacı ikonları.
 * `false` iken sunucu taraması (`getComponentFileTypes`) ve kayıt sonrası client-side
 * JSON parse çalışmaz; store boş kalır, ağaç varsayılan dosya gösterimini kullanır.
 *
 * Bootstrap cevabındaki `componentFileTypes` için sunucuda ayrıca
 * `WORKSPACE_BOOTSTRAP_SCAN_COMPONENT_FILE_TYPES` (`project.service.ts`) vardır;
 * ikonları tam geri açarken ikisini de `true` yapın.
 */
export const ENABLE_COMPONENT_FLOW_ICONS = false;
