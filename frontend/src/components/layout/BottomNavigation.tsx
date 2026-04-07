import { useEffect, useState, useRef } from 'react';
import styles from './BottomNavigation.module.scss';
import { Icon } from '@iconify/react';
import { Link, useLocation } from 'react-router-dom';

interface BottomNavigationItem {
    icon: string;
    path: string;
    label: string;
}

interface BottomNavigationProps {
    items: BottomNavigationItem[];
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ items }) => {

    const currentPath = useLocation().pathname;
    const [currentItemNum, setCurrentItemNum] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const bgEffectRef = useRef<HTMLDivElement>(null);

    const updateBgEffect = (element: HTMLElement) => {
        if (bgEffectRef.current) {
            const { offsetLeft, offsetWidth } = element;
            const finalOffsetLeft = offsetLeft - offsetWidth / 2 + 18;
            const finalOffsetTop = -25;
            bgEffectRef.current.style.transform = `translate(${finalOffsetLeft}px, ${finalOffsetTop}px)`;
        }
    };

    const currentItemRef = (element: HTMLAnchorElement | null) => {
        if (element) {
            updateBgEffect(element);
        }
    };

    useEffect(() => {
        const currentItem = items?.findIndex(item => item.path === currentPath);
        if (currentItem !== -1) {
            setCurrentItemNum(currentItem);
        } else {
            setCurrentItemNum(0);
        }
    }, [currentPath, items]);

    useEffect(() => {
        const shouldOpen = items?.some(item => item.path === currentPath);
        setIsOpen(shouldOpen);
    }, [currentPath, items]);

    useEffect(() => {
        // Update bg effect position when active item changes
        const activeElement = document.querySelector(`.${styles['bottom-navigation__item--active']}`);
        if (activeElement && bgEffectRef.current) {
            const { offsetLeft, offsetWidth } = activeElement as HTMLElement;
            const finalOffsetLeft = offsetLeft - offsetWidth / 2 + 18;
            const finalOffsetTop = -25;
            bgEffectRef.current.style.transform = `translate(${finalOffsetLeft}px, ${finalOffsetTop}px)`;
        }
    }, [currentItemNum, currentPath]);

    const getItems = () => {
        return items.map((item, index) => {
            const isActive = index === currentItemNum;
            const className = isActive ?
                `${styles['bottom-navigation__item']} ${styles['bottom-navigation__item--active']}` :
                `${styles['bottom-navigation__item']}`;
            return (
                <Link 
                    to={item.path} 
                    className={className} 
                    key={index} 
                    ref={isActive ? currentItemRef : null}
                >
                    <Icon className={styles['bottom-navigation__item-icon']} icon={item.icon} />
                    <span>{item.label}</span>
                </Link>
            );
        });
    };

    if (isOpen) return (
        <div className={styles['bottom-navigation']}>
            <div className={styles['bottom-navigation__wrapper']}>
                <div className={styles['bottom-navigation__items']}>
                    { getItems() }
                </div>
                <div className={styles['bottom-navigation__background']}></div>
                <div className={styles['bottom-navigation__bg-effect']} ref={bgEffectRef}></div>
            </div>
        </div>
    );
};