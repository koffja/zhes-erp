const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { db } = require('../db');

/**
 * 防伪背景水印函数
 */
function createAntiCounterfeitPattern(pageWidth, pageHeight) {
    const patternDoc = new PDFDocument({ autoFirstPage: false });
    const patternBuffer = [];
    patternDoc.pipe({ write: (chunk) => patternBuffer.push(chunk) });

    patternDoc.addPage({ size: 'A4', margin: 0 });

    // 极细微点
    const seed = 131;
    patternDoc.fillColor('#000000', 0.015);
    for (let i = 0; i < Math.floor(pageHeight / 20); i++) {
        for (let j = 0; j < Math.floor(pageWidth / 20); j++) {
            const hash = ((seed * i + j * 7) % 100);
            if (hash < 5) {
                patternDoc.circle(j * 20 + 10, i * 20 + 10, 0.3).fill();
            }
        }
    }

    // 微编码文字
    patternDoc.fontSize(3);
    patternDoc.fillColor('#000000', 0.01);
    const code = 'SECURE';
    for (let x = 30; x < pageWidth; x += 100) {
        for (let y = 30; y < pageHeight; y += 30) {
            patternDoc.text(code, x, y, { lineBreak: false });
        }
    }

    patternDoc.end();
    return Buffer.concat(patternBuffer);
}

/**
 * 生成订单PDF
 */
async function generateOrderPDF(orderId, res) {
    const order = db.prepare(`
        SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.id = ?
    `).get(orderId);

    if (!order) {
        throw new Error('订单不存在');
    }

    const items = db.prepare(`
        SELECT oi.*, p.name as product_name, p.specs
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
    `).all(order.id);

    // 生成文件名
    const orderDate = order.order_date || order.created_at;
    const dateStr = orderDate ? orderDate.replace(/-/g, '').substring(2, 8) : '000000';
    const orderPerson = (order.customer_name || order.shipping_name || 'Customer').replace(/[\\/:*?"<>|]/g, '_');
    const orderNoSuffix = (order.order_no || '00000').slice(-5);
    const filename = `${dateStr}_${orderPerson}_${orderNoSuffix}.pdf`;

    // 设置响应头
    const encodedFilename = encodeURIComponent(filename);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);

    // PDF加密密钥
    const pdfPassword = 'c2X5XuRoLQocgK9dBxbA7Hi+nF6jE4ITEBb90gzoWLY=';

    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        encryption: {
            ownerPassword: pdfPassword,
            userPassword: pdfPassword,
            permissions: {
                printing: 'highResolution',
                modifying: false,
                copying: false,
                annotating: false,
                fillingForms: false,
                contentAccessibility: false,
                documentAssembly: false
            }
        }
    });
    doc.pipe(res);

    // 页面尺寸
    const pageWidth = 595.28;
    const pageHeight = 841.89;

    // 防伪背景
    let backgroundDrawn = false;
    doc.on('page', () => {
        if (!backgroundDrawn) {
            backgroundDrawn = true;
            doc.save();
            doc.fillColor('#000000', 0.012);
            for (let i = 0; i < 60; i++) {
                for (let j = 0; j < 40; j++) {
                    if ((i * 17 + j * 13) % 20 < 2) {
                        doc.circle(j * 15 + 30, i * 20 + 30, 0.4).fill();
                    }
                }
            }
            doc.restore();
        }
    });

    // 加载中文字体
    let fontName = 'Helvetica';
    let fontBoldName = 'Helvetica-Bold';
    try {
        const fontPath = path.join(__dirname, '../../node_modules', '@fontpkg', 'alibaba-puhuiti-2-0', 'AlibabaPuHuiTi-2-55-Regular.ttf');
        const fontBoldPath = path.join(__dirname, '../../node_modules', '@fontpkg', 'alibaba-puhuiti-2-0', 'AlibabaPuHuiTi-2-85-Bold.ttf');
        if (fs.existsSync(fontPath)) {
            doc.registerFont('Alibaba-Regular', fontPath);
            doc.registerFont('Alibaba-Bold', fontBoldPath);
            fontName = 'Alibaba-Regular';
            fontBoldName = 'Alibaba-Bold';
            console.log('Alibaba PuHuiTi font loaded successfully');
        }
    } catch (e) {
        console.error('Font loading error:', e.message);
    }

    // 标题
    doc.font(fontBoldName).fontSize(20).text('折石咖啡订单', { align: 'center' });
    doc.font(fontName).fontSize(10).text('上海欧焙客贸易有限公司', { align: 'center' });
    doc.moveDown();

    // 订单信息
    doc.font(fontName).fontSize(11);
    doc.text(`订单号: ${order.order_no}`);
    const orderNoY = doc.y;
    doc.text(`日期: ${order.created_at}`);
    doc.text(`订购人: ${order.customer_name || '-'}`);
    doc.text(`收件人: ${order.shipping_name || order.customer_name || '-'}`);
    doc.text(`电话: ${order.shipping_phone || order.customer_phone || '-'}`);
    doc.text(`地址: ${order.shipping_address || order.customer_address || '-'}`);
    doc.moveDown();

    // 表格
    const tableTop = doc.y;
    doc.fontSize(10);
    doc.text('序号', 50, tableTop);
    doc.text('产品', 80, tableTop);
    doc.text('规格', 220, tableTop);
    doc.text('数量', 320, tableTop);
    doc.text('单价', 380, tableTop);
    doc.text('小计', 460, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    let y = tableTop + 25;
    let subtotal = 0;
    items.forEach((item, index) => {
        doc.text((index + 1).toString(), 50, y);
        doc.text((item.product_name || '-').substring(0, 18), 80, y);
        doc.text((item.specs || '-').substring(0, 12), 220, y);
        doc.text(item.quantity.toString(), 320, y);
        doc.text('¥' + item.unit_price, 380, y);
        doc.text('¥' + item.subtotal, 460, y);
        subtotal += item.subtotal || 0;
        y += 18;
    });

    // 运费计算
    const shippingFee = order.shipping_fee || 0;
    const totalWithShipping = subtotal + shippingFee;
    const outstanding = totalWithShipping - (order.paid_amount || 0);

    // 总计
    y += 10;
    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 18;

    if (shippingFee > 0) {
        doc.fontSize(11).text(`产品小计: ¥${subtotal}`, 50, y);
        y += 16;
        doc.text(`运费: ¥${shippingFee}`, 50, y);
        y += 16;
        doc.fontSize(12).text(`合计: ¥${totalWithShipping}`, 50, y);
    } else {
        doc.fontSize(12).text(`合计: ¥${subtotal}`, 50, y);
        y += 16;
    }

    // 右侧：已付和应收
    let rightY = y - 16;
    if (shippingFee > 0) rightY = y - 32;
    doc.text(`已付: ¥${order.paid_amount || 0}`, 320, rightY);
    if (outstanding > 0) {
        doc.text(`应收: ¥${outstanding}`, 320, rightY + 16, { color: '#ff0000' });
    }

    // 备注
    if (order.note) {
        doc.moveDown(3);
        doc.text(`备注: ${order.note}`);
    }

    // 公章浮水印
    try {
        const stampX = 430;
        const stampY = orderNoY + 15;
        const stampPath = path.join(__dirname, '../../public', 'stamp.png');
        if (fs.existsSync(stampPath)) {
            doc.image(stampPath, stampX, stampY, {
                fit: [150, 150],
                opacity: 0.2
            });
        }
    } catch (e) {
        console.error('Stamp image error:', e.message);
    }

    doc.end();
}

module.exports = {
    generateOrderPDF
};
