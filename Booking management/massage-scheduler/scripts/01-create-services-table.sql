-- Create massage services table
CREATE TABLE IF NOT EXISTS massage_services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default massage services
INSERT INTO massage_services (name, description, duration_minutes, price) VALUES
('Swedish Massage', 'Relaxing full-body massage with gentle pressure', 60, 80.00),
('Deep Tissue Massage', 'Therapeutic massage targeting muscle tension', 90, 120.00),
('Hot Stone Massage', 'Soothing massage with heated stones', 75, 100.00),
('Aromatherapy Massage', 'Relaxing massage with essential oils', 60, 90.00),
('Sports Massage', 'Targeted massage for athletes and active individuals', 60, 95.00);
