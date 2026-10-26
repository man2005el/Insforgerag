-- ============================================================================
-- Datos de prueba: usuarios, productos, facturas y detalle de compras
-- Motor: PostgreSQL
-- Moneda: Soles peruanos (PEN)
-- ============================================================================

DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    phone VARCHAR(20),
    city VARCHAR(60),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(60) NOT NULL,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    stock INT NOT NULL DEFAULT 0
);

CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(20) NOT NULL UNIQUE,
    user_id INT NOT NULL REFERENCES users(id),
    issued_at DATE NOT NULL,
    status VARCHAR(15) NOT NULL DEFAULT 'pagada' CHECK (status IN ('pagada','pendiente','anulada')),
    subtotal NUMERIC(10,2) NOT NULL,
    igv NUMERIC(10,2) NOT NULL, -- 18%
    total NUMERIC(10,2) NOT NULL
);

CREATE TABLE invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL,
    line_total NUMERIC(10,2) NOT NULL
);

-- Permisos
GRANT ALL ON public.users, public.products, public.invoices, public.invoice_items TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ============================================================================
-- Usuarios
-- ============================================================================

INSERT INTO users (first_name, last_name, email, phone, city) VALUES
('Carlos', 'Flores', 'carlos.flores4@example.com', '+51 946913810', 'Chiclayo'),
('María', 'Rojas', 'maria.rojas18@example.com', '+51 923756669', 'Huancayo'),
('José', 'Quispe', 'jose.quispe76@example.com', '+51 966629388', 'Lima'),
('Ana', 'Ramírez', 'ana.ramirez12@example.com', '+51 939345092', 'Chiclayo'),
('Luis', 'Campos', 'luis.campos78@example.com', '+51 913561597', 'Huancayo'),
('Carmen', 'Castillo', 'carmen.castillo92@example.com', '+51 997226012', 'Huancayo'),
('Jorge', 'Espinoza', 'jorge.espinoza29@example.com', '+51 970291817', 'Tacna'),
('Rosa', 'Vargas', 'rosa.vargas1@example.com', '+51 931429110', 'Ica'),
('Miguel', 'Paredes', 'miguel.paredes36@example.com', '+51 930868105', 'Chiclayo'),
('Lucía', 'Paredes', 'lucia.paredes14@example.com', '+51 922448136', 'Ica'),
('Pedro', 'Flores', 'pedro.flores46@example.com', '+51 956164955', 'Tacna'),
('Valeria', 'Vargas', 'valeria.vargas6@example.com', '+51 971662963', 'Huancayo'),
('Diego', 'Flores', 'diego.flores49@example.com', '+51 920576383', 'Huancayo'),
('Sofía', 'Huamán', 'sofia.huaman81@example.com', '+51 993016315', 'Piura'),
('Andrés', 'Díaz', 'andres.diaz25@example.com', '+51 919335534', 'Lima'),
('Camila', 'Rojas', 'camila.rojas99@example.com', '+51 948840994', 'Arequipa'),
('Ricardo', 'Rojas', 'ricardo.rojas13@example.com', '+51 961019678', 'Cusco'),
('Fiorella', 'Gutiérrez', 'fiorella.gutierrez82@example.com', '+51 958966946', 'Trujillo'),
('Juan', 'Chávez', 'juan.chavez46@example.com', '+51 938119557', 'Cusco'),
('Daniela', 'Quispe', 'daniela.quispe78@example.com', '+51 995225343', 'Trujillo');

-- ============================================================================
-- Productos
-- ============================================================================

INSERT INTO products (name, category, price, stock) VALUES
('Laptop Lenovo IdeaPad 3', 'Tecnología', 2199.00, 73),
('Mouse Logitech M185', 'Tecnología', 45.90, 98),
('Teclado mecánico Redragon Kumara', 'Tecnología', 159.00, 36),
('Monitor LG 24'''' Full HD', 'Tecnología', 549.00, 25),
('Audífonos Sony WH-CH520', 'Tecnología', 219.00, 64),
('Webcam Logitech C920', 'Tecnología', 329.00, 53),
('Disco SSD Kingston 480GB', 'Tecnología', 189.00, 39),
('Memoria USB SanDisk 64GB', 'Tecnología', 32.50, 86),
('Router TP-Link Archer C6', 'Tecnología', 145.00, 93),
('Raspberry Pi 5 8GB', 'Tecnología', 469.00, 76),
('Cafetera Oster 12 tazas', 'Hogar', 179.90, 33),
('Licuadora Oster Xpert', 'Hogar', 399.00, 92),
('Hervidor eléctrico Imaco', 'Hogar', 69.90, 46),
('Aspiradora Electrolux 1600W', 'Hogar', 289.00, 112),
('Ventilador de torre Miray', 'Hogar', 149.90, 103),
('Silla ergonómica de oficina', 'Muebles', 499.00, 104),
('Escritorio gamer 120cm', 'Muebles', 379.00, 12),
('Estante de melamina 5 niveles', 'Muebles', 219.00, 34),
('Polo algodón pima', 'Ropa', 49.90, 110),
('Casaca impermeable', 'Ropa', 139.90, 9),
('Zapatillas urbanas', 'Ropa', 189.90, 108),
('Mochila portalaptop 15.6''''', 'Accesorios', 89.90, 45),
('Botella térmica 750ml', 'Accesorios', 55.00, 56),
('Cargador USB-C 65W', 'Accesorios', 79.90, 39),
('Cable HDMI 2m', 'Accesorios', 25.90, 13),
('Arroz Costeño 5kg', 'Abarrotes', 27.50, 32),
('Aceite Primor 1L', 'Abarrotes', 9.80, 77),
('Café Altomayo 200g', 'Abarrotes', 15.90, 117),
('Leche Gloria pack x6', 'Abarrotes', 21.60, 96),
('Detergente Bolívar 4kg', 'Abarrotes', 42.90, 45);

-- ============================================================================
-- Facturas
-- ============================================================================

INSERT INTO invoices (invoice_number, user_id, issued_at, status, subtotal, igv, total) VALUES
('F001-00001', 7, '2026-06-16', 'pagada', 1396.70, 251.41, 1648.11),
('F001-00002', 19, '2026-04-19', 'pagada', 817.00, 147.06, 964.06),
('F001-00003', 2, '2026-01-05', 'pagada', 1097.30, 197.51, 1294.81),
('F001-00004', 4, '2026-06-18', 'pendiente', 1776.00, 319.68, 2095.68),
('F001-00005', 9, '2026-05-25', 'pagada', 47.70, 8.59, 56.29),
('F001-00006', 10, '2026-06-17', 'pagada', 476.70, 85.81, 562.51),
('F001-00007', 17, '2026-01-20', 'pagada', 1098.00, 197.64, 1295.64),
('F001-00008', 10, '2026-02-02', 'pagada', 477.00, 85.86, 562.86),
('F001-00009', 16, '2026-01-25', 'pagada', 707.70, 127.39, 835.09),
('F001-0010', 6, '2026-03-17', 'pendiente', 992.40, 178.63, 1171.03),
('F001-00011', 10, '2026-04-22', 'pagada', 1648.50, 296.73, 1945.23),
('F001-00012', 1, '2026-05-18', 'pagada', 7074.00, 1273.32, 8347.32),
('F001-00013', 2, '2026-02-03', 'pendiente', 1520.00, 273.60, 1793.60),
('F001-00014', 7, '2026-05-05', 'pagada', 1426.00, 256.68, 1682.68),
('F001-00015', 14, '2026-03-14', 'pagada', 269.70, 48.55, 318.25),
('F001-00016', 4, '2026-01-13', 'pagada', 32.50, 5.85, 38.35),
('F001-00017', 7, '2026-05-15', 'pagada', 294.90, 53.08, 347.98),
('F001-00018', 15, '2026-05-04', 'pagada', 159.00, 28.62, 187.62),
('F001-00019', 6, '2026-04-16', 'pagada', 911.20, 164.02, 1075.22),
('F001-00020', 10, '2026-04-23', 'anulada', 2676.90, 481.84, 3158.74),
('F001-00021', 11, '2026-01-02', 'pagada', 424.90, 76.48, 501.38),
('F001-00022', 3, '2026-05-03', 'pagada', 758.70, 136.57, 895.27),
('F001-00023', 19, '2026-05-02', 'pagada', 1906.40, 343.15, 2249.55),
('F001-00024', 11, '2026-02-09', 'pagada', 415.60, 74.81, 490.41),
('F001-00025', 20, '2026-05-04', 'pagada', 669.00, 120.42, 789.42),
('F001-00026', 3, '2026-02-12', 'pagada', 1320.40, 237.67, 1558.07),
('F001-00027', 18, '2026-03-22', 'pagada', 1792.00, 322.56, 2114.56),
('F001-00028', 18, '2026-02-09', 'pagada', 594.70, 107.05, 701.75),
('F001-00029', 9, '2026-05-16', 'pagada', 477.00, 85.86, 562.86),
('F001-00030', 14, '2026-03-02', 'pagada', 624.90, 112.48, 737.38),
('F001-00031', 15, '2026-05-23', 'pagada', 549.00, 98.82, 647.82),
('F001-00032', 5, '2026-05-02', 'pendiente', 727.00, 130.86, 857.86),
('F001-00033', 12, '2026-01-12', 'pagada', 1826.80, 328.82, 2155.62),
('F001-00034', 14, '2026-05-24', 'pagada', 673.90, 121.30, 795.20),
('F001-00035', 1, '2026-02-24', 'pendiente', 462.90, 83.32, 546.22),
('F001-00036', 4, '2026-04-28', 'pagada', 505.50, 90.99, 596.49),
('F001-00037', 8, '2026-01-22', 'pagada', 798.80, 143.78, 942.58),
('F001-00038', 17, '2026-04-22', 'anulada', 5011.80, 902.12, 5913.92),
('F001-00039', 9, '2026-01-04', 'pagada', 782.00, 140.76, 922.76),
('F001-00040', 4, '2026-04-19', 'pagada', 110.00, 19.80, 129.80);

-- ============================================================================
-- Detalle de Facturas (invoice_items)
-- ============================================================================

INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, line_total) VALUES
(1, 5, 3, 219.00, 657.00),
(1, 9, 3, 145.00, 435.00),
(1, 8, 2, 32.50, 65.00),
(1, 24, 3, 79.90, 239.70),
(2, 5, 2, 219.00, 438.00),
(2, 17, 1, 379.00, 379.00),
(3, 20, 3, 139.90, 419.70),
(3, 3, 2, 159.00, 318.00),
(3, 13, 3, 69.90, 209.70),
(3, 15, 1, 149.90, 149.90),
(4, 4, 1, 549.00, 549.00),
(4, 10, 2, 469.00, 938.00),
(4, 14, 1, 289.00, 289.00),
(5, 28, 3, 15.90, 47.70),
(6, 12, 1, 399.00, 399.00),
(6, 25, 3, 25.90, 77.70),
(7, 4, 2, 549.00, 1098.00),
(8, 3, 3, 159.00, 477.00),
(9, 5, 2, 219.00, 438.00),
(9, 22, 3, 89.90, 269.70),
(10, 7, 3, 189.00, 567.00),
(10, 30, 3, 42.90, 128.70),
(10, 18, 1, 219.00, 219.00),
(10, 25, 3, 25.90, 77.70),
(11, 29, 1, 21.60, 21.60),
(11, 17, 1, 379.00, 379.00),
(11, 15, 1, 149.90, 149.90),
(11, 4, 2, 549.00, 1098.00),
(12, 1, 3, 2199.00, 6597.00),
(12, 3, 3, 159.00, 477.00),
(13, 3, 2, 159.00, 318.00),
(13, 17, 3, 379.00, 1137.00),
(13, 8, 2, 32.50, 65.00),
(14, 8, 1, 32.50, 32.50),
(14, 26, 1, 27.50, 27.50),
(14, 16, 1, 499.00, 499.00),
(14, 14, 3, 289.00, 867.00),
(15, 22, 3, 89.90, 269.70),
(16, 8, 1, 32.50, 32.50),
(17, 9, 1, 145.00, 145.00),
(17, 15, 1, 149.90, 149.90),
(18, 3, 1, 159.00, 159.00),
(19, 29, 1, 21.60, 21.60),
(19, 2, 2, 45.90, 91.80),
(19, 6, 2, 329.00, 658.00),
(19, 13, 2, 69.90, 139.80),
(20, 5, 3, 219.00, 657.00),
(20, 7, 3, 189.00, 567.00),
(20, 10, 3, 469.00, 1407.00),
(20, 2, 1, 45.90, 45.90),
(21, 2, 1, 45.90, 45.90),
(21, 17, 1, 379.00, 379.00),
(22, 13, 3, 69.90, 209.70),
(22, 4, 1, 549.00, 549.00),
(23, 22, 2, 89.90, 179.80),
(23, 19, 1, 49.90, 49.90),
(23, 17, 3, 379.00, 1137.00),
(23, 11, 3, 179.90, 539.70),
(24, 15, 1, 149.90, 149.90),
(24, 11, 1, 179.90, 179.90),
(24, 30, 2, 42.90, 85.80),
(25, 17, 1, 379.00, 379.00),
(25, 9, 2, 145.00, 290.00),
(26, 27, 3, 9.80, 29.40),
(26, 18, 3, 219.00, 657.00),
(26, 23, 3, 55.00, 165.00),
(26, 10, 1, 469.00, 469.00),
(27, 9, 1, 145.00, 145.00),
(27, 4, 3, 549.00, 1647.00),
(28, 23, 1, 55.00, 55.00),
(28, 11, 3, 179.90, 539.70),
(29, 3, 3, 159.00, 477.00),
(30, 21, 1, 189.90, 189.90),
(30, 9, 3, 145.00, 435.00),
(31, 4, 1, 549.00, 549.00),
(32, 14, 1, 289.00, 289.00),
(32, 5, 2, 219.00, 438.00),
(33, 22, 2, 89.90, 179.80),
(33, 4, 3, 549.00, 1647.00),
(34, 28, 1, 15.90, 15.90),
(34, 6, 2, 329.00, 658.00),
(35, 26, 1, 27.50, 27.50),
(35, 22, 2, 89.90, 179.80),
(35, 28, 1, 15.90, 15.90),
(35, 24, 3, 79.90, 239.70),
(36, 8, 2, 32.50, 65.00),
(36, 7, 2, 189.00, 378.00),
(36, 27, 2, 9.80, 19.60),
(36, 30, 1, 42.90, 42.90),
(37, 9, 2, 145.00, 290.00),
(37, 28, 2, 15.90, 31.80),
(37, 3, 3, 159.00, 477.00),
(38, 1, 2, 2199.00, 4398.00),
(38, 4, 1, 549.00, 549.00),
(38, 29, 3, 21.60, 64.80),
(39, 24, 2, 79.90, 159.80),
(39, 26, 3, 27.50, 82.50),
(39, 11, 3, 179.90, 539.70),
(40, 23, 2, 55.00, 110.00);
