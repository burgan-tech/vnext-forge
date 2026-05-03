*.diagram.json Geliştirmesi.

Workflow bileşeni için layout tasarımına sahip. Şuan mevcutta layoutta ki node dizimleri kaydedilmiyor. Bu da her defasında layout'un sıfırlanmasına sebebiyet veriyor. Kalıcı hale getirmek için geliştirme kapsamı;

- Bir workflow bileşeni open edildiğinde background'da mevcut path'inde ".meta" klasörü yaratılır. Varsa bypass et hata verme.
- Açılan dosya adını alarak; "WORKFLOW_FILE_NAME.diagram.json" şeklinde bir dosya yarat. 
- Bu dosyada json formatında, sadece layout düzenini oluşturan verileri tut.
- Her workflow bileşeni open olduğunda bu dosyadaki veriyi okuyarak layout'u buna göre çiz.
- Diagram dosyasına yazma işlemi bileşeni kaydetme ile beraber olsun ve backgrounda paralel async istek ile yapılsın. Geliştiricinin layout ortamını hiç bir zaman bloklamasın.

DİKKAT: vNext'in legacy olan designer tool'uda aynı formatta dosya üretiyor eğer dosya içeriği bizim formatımızda değilse hata verme bizim bilgiler ile ovveride et. Dolayısı ile her zaman uyumluluğu kontol et. 

